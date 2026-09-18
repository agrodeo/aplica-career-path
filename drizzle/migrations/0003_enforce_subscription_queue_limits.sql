-- Enforce active subscription + weekly queue limits inside the database so
-- concurrent batch requests cannot overbook a plan before a worker starts.
CREATE OR REPLACE FUNCTION public.enqueue_application(
  _user_id uuid,
  _job_id uuid,
  _batch_id uuid DEFAULT NULL,
  _priority integer DEFAULT 100
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _consent boolean;
  _eligible boolean;
  _attempt uuid;
  _subscription_status text;
  _weekly_limit integer;
  _period_start timestamptz;
  _period_end timestamptz;
  _consumed integer := 0;
  _outstanding integer := 0;
BEGIN
  SELECT authorized
  INTO _consent
  FROM public.auto_apply_consents
  WHERE user_id = _user_id
    AND revoked_at IS NULL;

  IF _consent IS NOT TRUE THEN
    RETURN 'consent_missing';
  END IF;

  -- Lock the user's subscription row. Calls for the same user serialize here,
  -- so two simultaneous batches cannot both observe the same remaining limit.
  SELECT
    s.status,
    p.weekly_application_limit,
    COALESCE(
      s.current_period_start,
      date_trunc('week', now())
    ),
    COALESCE(
      s.current_period_end,
      date_trunc('week', now()) + interval '7 days'
    )
  INTO
    _subscription_status,
    _weekly_limit,
    _period_start,
    _period_end
  FROM public.subscriptions s
  LEFT JOIN public.plans p ON p.code = s.plan_code
  WHERE s.user_id = _user_id
  FOR UPDATE OF s;

  IF _subscription_status IS DISTINCT FROM 'active' OR _weekly_limit IS NULL THEN
    RETURN 'subscription_required';
  END IF;

  SELECT COALESCE(SUM(c.consumed), 0)::integer
  INTO _consumed
  FROM public.application_credits c
  WHERE c.user_id = _user_id
    AND c.period_start >= _period_start::date
    AND c.period_start < _period_end::date;

  SELECT COUNT(*)::integer
  INTO _outstanding
  FROM public.application_attempts a
  WHERE a.user_id = _user_id
    AND a.queued_at >= _period_start
    AND a.queued_at < _period_end
    AND a.status IN (
      'queued',
      'preparing',
      'resume_generating',
      'ready',
      'submitting',
      'submitted_unverified',
      'failed_retryable'
    );

  IF _consumed + _outstanding >= _weekly_limit THEN
    RETURN 'limit_reached';
  END IF;

  SELECT auto_apply_eligible AND is_active
  INTO _eligible
  FROM public.jobs
  WHERE id = _job_id;

  IF _eligible IS NOT TRUE THEN
    RETURN 'unsupported';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.application_attempts
    WHERE user_id = _user_id
      AND job_id = _job_id
      AND status = 'verified'
  ) THEN
    RETURN 'duplicate';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.application_queue
    WHERE user_id = _user_id
      AND job_id = _job_id
  ) THEN
    RETURN 'duplicate';
  END IF;

  INSERT INTO public.application_attempts (
    user_id,
    job_id,
    batch_id,
    status,
    adapter
  )
  SELECT
    _user_id,
    _job_id,
    _batch_id,
    'queued',
    j.auto_apply_adapter
  FROM public.jobs j
  WHERE j.id = _job_id
  RETURNING id INTO _attempt;

  INSERT INTO public.application_queue (
    user_id,
    job_id,
    attempt_id,
    batch_id,
    priority
  )
  VALUES (
    _user_id,
    _job_id,
    _attempt,
    _batch_id,
    _priority
  );

  INSERT INTO public.application_audit_log (
    user_id,
    job_id,
    application_attempt_id,
    event_type
  )
  VALUES (
    _user_id,
    _job_id,
    _attempt,
    'application_queued'
  );

  IF _batch_id IS NOT NULL THEN
    UPDATE public.application_batches
    SET queued_count = queued_count + 1
    WHERE id = _batch_id;
  END IF;

  RETURN 'queued';
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_application(uuid,uuid,uuid,integer) FROM public;
GRANT EXECUTE ON FUNCTION public.enqueue_application(uuid,uuid,uuid,integer) TO service_role;
