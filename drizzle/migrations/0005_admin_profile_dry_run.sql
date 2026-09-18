-- Admin-only profile-aware dry runs.
-- These queue items are always processed with dry_run=true even if the worker
-- itself is later switched to production mode. They never consume credits.
ALTER TABLE public.application_attempts
  ADD COLUMN test_mode boolean NOT NULL DEFAULT false;

ALTER TABLE public.application_queue
  ADD COLUMN test_mode boolean NOT NULL DEFAULT false;

CREATE INDEX application_attempts_test_mode_idx
  ON public.application_attempts(test_mode, queued_at DESC);

CREATE OR REPLACE FUNCTION public.enqueue_admin_dry_run(
  _user_id uuid,
  _job_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _consent boolean;
  _eligible boolean;
  _attempt uuid;
  _queue uuid;
BEGIN
  IF public.has_role(_user_id, 'admin') IS NOT TRUE THEN
    RAISE EXCEPTION 'admin_required';
  END IF;

  SELECT authorized
  INTO _consent
  FROM public.auto_apply_consents
  WHERE user_id = _user_id
    AND revoked_at IS NULL;

  IF _consent IS NOT TRUE THEN
    RAISE EXCEPTION 'consent_missing';
  END IF;

  SELECT auto_apply_eligible AND is_active
  INTO _eligible
  FROM public.jobs
  WHERE id = _job_id;

  IF _eligible IS NOT TRUE THEN
    RAISE EXCEPTION 'job_not_eligible';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.application_queue
    WHERE user_id = _user_id
      AND job_id = _job_id
  ) THEN
    RAISE EXCEPTION 'job_already_queued';
  END IF;

  INSERT INTO public.application_attempts (
    user_id,
    job_id,
    status,
    adapter,
    test_mode
  )
  SELECT
    _user_id,
    _job_id,
    'queued',
    j.auto_apply_adapter,
    true
  FROM public.jobs j
  WHERE j.id = _job_id
  RETURNING id INTO _attempt;

  INSERT INTO public.application_queue (
    user_id,
    job_id,
    attempt_id,
    priority,
    test_mode
  )
  VALUES (
    _user_id,
    _job_id,
    _attempt,
    1,
    true
  )
  RETURNING id INTO _queue;

  INSERT INTO public.application_audit_log (
    user_id,
    job_id,
    application_attempt_id,
    event_type,
    metadata
  )
  VALUES (
    _user_id,
    _job_id,
    _attempt,
    'admin_dry_run_queued',
    jsonb_build_object('test_mode', true)
  );

  RETURN _queue;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_admin_dry_run(uuid,uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.enqueue_admin_dry_run(uuid,uuid) TO service_role;

-- A future programming mistake must never turn a test queue item into a paid
-- verified application or consume a credit.
CREATE OR REPLACE FUNCTION public.complete_application(
  _queue_id uuid,
  _submission_reference text,
  _evidence_path text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _q public.application_queue;
  _week_start date;
BEGIN
  SELECT *
  INTO _q
  FROM public.application_queue
  WHERE id = _queue_id
  FOR UPDATE;

  IF _q.id IS NULL THEN
    RETURN 'not_found';
  END IF;

  IF _q.test_mode IS TRUE THEN
    RETURN 'test_mode_refused';
  END IF;

  UPDATE public.application_attempts
  SET
    status = 'verified',
    submitted_at = COALESCE(submitted_at, now()),
    verified_at = now(),
    submission_reference = _submission_reference,
    evidence_path = _evidence_path
  WHERE id = _q.attempt_id;

  _week_start := date_trunc('week', now())::date;
  INSERT INTO public.application_credits (
    user_id,
    period_start,
    period_end,
    granted,
    consumed
  )
  VALUES (
    _q.user_id,
    _week_start,
    _week_start + 6,
    0,
    1
  )
  ON CONFLICT (user_id, period_start)
  DO UPDATE SET
    consumed = public.application_credits.consumed + 1,
    updated_at = now();

  INSERT INTO public.application_audit_log (
    user_id,
    job_id,
    application_attempt_id,
    event_type
  )
  VALUES
    (_q.user_id, _q.job_id, _q.attempt_id, 'submission_verified'),
    (_q.user_id, _q.job_id, _q.attempt_id, 'credit_consumed');

  IF _q.batch_id IS NOT NULL THEN
    UPDATE public.application_batches
    SET
      verified_count = verified_count + 1,
      queued_count = GREATEST(queued_count - 1, 0)
    WHERE id = _q.batch_id;
  END IF;

  DELETE FROM public.application_queue WHERE id = _queue_id;
  RETURN 'verified';
END;
$$;

REVOKE ALL ON FUNCTION public.complete_application(uuid,text,text) FROM public;
GRANT EXECUTE ON FUNCTION public.complete_application(uuid,text,text) TO service_role;
