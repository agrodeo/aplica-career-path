-- Two distinct submission mechanisms; a job is only eligible when one is fully supported.
ALTER TABLE public.jobs ADD COLUMN submission_mechanism text NOT NULL DEFAULT 'unsupported';
ALTER TABLE public.jobs ADD COLUMN ineligibility_reason text;

-- Verification evidence on the attempt itself.
ALTER TABLE public.application_attempts ADD COLUMN verification_type text;
ALTER TABLE public.application_attempts ADD COLUMN verification_value text;

-- Resume variant cache key: user + job + profile version.
ALTER TABLE public.profiles ADD COLUMN master_profile_version integer NOT NULL DEFAULT 1;
ALTER TABLE public.resume_variants ADD COLUMN master_profile_version integer NOT NULL DEFAULT 1;
CREATE UNIQUE INDEX resume_variants_cache_idx ON public.resume_variants (user_id, job_id, master_profile_version);

-- Application schema inspection detail used by the eligibility scanner.
ALTER TABLE public.application_schemas ADD COLUMN unknown_required_fields jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.application_schemas ADD COLUMN captcha_detected boolean NOT NULL DEFAULT false;
ALTER TABLE public.application_schemas ADD COLUMN login_required boolean NOT NULL DEFAULT false;

-- Admin adapter test console: inspections are executed by the external worker.
CREATE TABLE public.adapter_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by uuid NOT NULL,
  url text NOT NULL,
  mode text NOT NULL DEFAULT 'inspect',
  status text NOT NULL DEFAULT 'queued',
  adapter text,
  ats_type text,
  auto_apply_eligible boolean,
  captcha_detected boolean,
  login_required boolean,
  required_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  mapped_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  unknown_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  reason text,
  error_code text,
  error_message text,
  worker_id text,
  locked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
GRANT SELECT, INSERT ON public.adapter_inspections TO authenticated;
GRANT ALL ON public.adapter_inspections TO service_role;
ALTER TABLE public.adapter_inspections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read inspections" ON public.adapter_inspections FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins create inspections" ON public.adapter_inspections FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') AND auth.uid() = requested_by);
CREATE INDEX adapter_inspections_claim_idx ON public.adapter_inspections (status, created_at);
ALTER PUBLICATION supabase_realtime ADD TABLE public.adapter_inspections;

-- Atomic claim for inspection work, same SKIP LOCKED discipline as applications.
CREATE OR REPLACE FUNCTION public.claim_inspection(_worker_id text, _limit integer DEFAULT 1)
RETURNS SETOF public.adapter_inspections LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT id FROM public.adapter_inspections
    WHERE status = 'queued'
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT _limit
  )
  UPDATE public.adapter_inspections i
  SET status = 'running', locked_at = now(), worker_id = _worker_id
  FROM picked WHERE i.id = picked.id
  RETURNING i.*;
END; $$;
REVOKE ALL ON FUNCTION public.claim_inspection(text,integer) FROM public;
GRANT EXECUTE ON FUNCTION public.claim_inspection(text,integer) TO service_role;