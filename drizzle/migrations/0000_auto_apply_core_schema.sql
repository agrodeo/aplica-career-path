-- ============ ROLES ============
CREATE TYPE public.app_role AS ENUM ('admin','user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own roles readable" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ CAREER PROFILE ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  first_name text,
  last_name text,
  email text,
  phone text,
  whatsapp text,
  city text,
  country text,
  linkedin_url text,
  portfolio_url text,
  current_title text,
  professional_summary text,
  base_resume_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.experiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company text NOT NULL,
  title text NOT NULL,
  start_date date,
  end_date date,
  is_current boolean NOT NULL DEFAULT false,
  description text,
  achievements jsonb NOT NULL DEFAULT '[]'::jsonb,
  source text NOT NULL DEFAULT 'cv_parse',
  verified_by_user boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.experiences TO authenticated;
GRANT ALL ON public.experiences TO service_role;
ALTER TABLE public.experiences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own experiences" ON public.experiences FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER experiences_touch BEFORE UPDATE ON public.experiences FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.educations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  institution text NOT NULL,
  degree text,
  field text,
  start_date date,
  end_date date,
  is_current boolean NOT NULL DEFAULT false,
  verified_by_user boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.educations TO authenticated;
GRANT ALL ON public.educations TO service_role;
ALTER TABLE public.educations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own educations" ON public.educations FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER educations_touch BEFORE UPDATE ON public.educations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  years_experience numeric,
  verified_by_user boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.skills TO authenticated;
GRANT ALL ON public.skills TO service_role;
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own skills" ON public.skills FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.languages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  language text NOT NULL,
  level text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, language)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.languages TO authenticated;
GRANT ALL ON public.languages TO service_role;
ALTER TABLE public.languages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own languages" ON public.languages FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.job_preferences (
  user_id uuid PRIMARY KEY,
  target_roles text[] NOT NULL DEFAULT '{}',
  target_locations text[] NOT NULL DEFAULT '{}',
  remote_allowed boolean NOT NULL DEFAULT true,
  hybrid_allowed boolean NOT NULL DEFAULT true,
  onsite_allowed boolean NOT NULL DEFAULT false,
  employment_types text[] NOT NULL DEFAULT '{}',
  minimum_salary numeric,
  salary_currency text,
  salary_period text,
  seniority_levels text[] NOT NULL DEFAULT '{}',
  willing_to_relocate boolean NOT NULL DEFAULT false,
  international_remote boolean NOT NULL DEFAULT true,
  excluded_companies text[] NOT NULL DEFAULT '{}',
  excluded_industries text[] NOT NULL DEFAULT '{}',
  preferred_industries text[] NOT NULL DEFAULT '{}',
  minimum_match_score numeric NOT NULL DEFAULT 80,
  maximum_applications_per_week integer,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_preferences TO authenticated;
GRANT ALL ON public.job_preferences TO service_role;
ALTER TABLE public.job_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own preferences" ON public.job_preferences FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER job_preferences_touch BEFORE UPDATE ON public.job_preferences FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.application_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  canonical_key text NOT NULL,
  answer_type text NOT NULL,
  boolean_value boolean,
  text_value text,
  numeric_value numeric,
  user_confirmed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, canonical_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_answers TO authenticated;
GRANT ALL ON public.application_answers TO service_role;
ALTER TABLE public.application_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own answers" ON public.application_answers FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER application_answers_touch BEFORE UPDATE ON public.application_answers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.auto_apply_consents (
  user_id uuid PRIMARY KEY,
  authorized boolean NOT NULL DEFAULT false,
  authorized_at timestamptz,
  terms_version text NOT NULL DEFAULT 'v1',
  revoked_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.auto_apply_consents TO authenticated;
GRANT ALL ON public.auto_apply_consents TO service_role;
ALTER TABLE public.auto_apply_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own consent" ON public.auto_apply_consents FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ INVENTORY ============
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  website text,
  careers_url text,
  logo_url text,
  ats_type text,
  ats_identifier text,
  auto_apply_supported boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  last_scanned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.companies TO authenticated, anon;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "companies readable" ON public.companies FOR SELECT TO authenticated, anon USING (active);
CREATE POLICY "admins manage companies" ON public.companies FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.job_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  type text NOT NULL,
  base_url text,
  adapter_name text NOT NULL,
  discovery_enabled boolean NOT NULL DEFAULT false,
  submission_enabled boolean NOT NULL DEFAULT false,
  requires_credentials boolean NOT NULL DEFAULT false,
  connection_status text NOT NULL DEFAULT 'not_connected',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.job_sources TO authenticated;
GRANT ALL ON public.job_sources TO service_role;
ALTER TABLE public.job_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sources readable" ON public.job_sources FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage sources" ON public.job_sources FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_job_id text NOT NULL,
  source_id uuid REFERENCES public.job_sources(id) ON DELETE SET NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  location text,
  country text,
  remote_type text,
  employment_type text,
  seniority text,
  salary_min numeric,
  salary_max numeric,
  salary_currency text,
  application_url text,
  ats_type text,
  auto_apply_eligible boolean NOT NULL DEFAULT false,
  auto_apply_adapter text,
  application_schema_id uuid,
  published_at timestamptz,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  last_verified_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (source_id, external_job_id)
);
GRANT SELECT ON public.jobs TO authenticated;
GRANT ALL ON public.jobs TO service_role;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auto apply inventory readable" ON public.jobs FOR SELECT TO authenticated USING (is_active AND auto_apply_eligible);
CREATE POLICY "admins read all jobs" ON public.jobs FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins manage jobs" ON public.jobs FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX jobs_eligible_idx ON public.jobs (auto_apply_eligible, is_active);

CREATE TABLE public.application_schemas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE,
  adapter text NOT NULL,
  schema_version text NOT NULL DEFAULT '1',
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  required_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  supports_file_upload boolean NOT NULL DEFAULT false,
  supports_auto_submit boolean NOT NULL DEFAULT false,
  last_verified_at timestamptz,
  valid boolean NOT NULL DEFAULT false
);
GRANT SELECT ON public.application_schemas TO authenticated;
GRANT ALL ON public.application_schemas TO service_role;
ALTER TABLE public.application_schemas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage schemas" ON public.application_schemas FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
ALTER TABLE public.jobs ADD CONSTRAINT jobs_application_schema_fk FOREIGN KEY (application_schema_id) REFERENCES public.application_schemas(id) ON DELETE SET NULL;

CREATE TABLE public.adapter_registry (
  adapter text PRIMARY KEY,
  label text NOT NULL,
  discovery boolean NOT NULL DEFAULT false,
  schema_discovery boolean NOT NULL DEFAULT false,
  submission boolean NOT NULL DEFAULT false,
  verification boolean NOT NULL DEFAULT false,
  public_discovery_supported boolean NOT NULL DEFAULT false,
  authorized_submission_supported boolean NOT NULL DEFAULT false,
  public_form_submission_supported boolean NOT NULL DEFAULT false,
  connection_status text NOT NULL DEFAULT 'not_connected',
  health text NOT NULL DEFAULT 'down',
  last_error text,
  last_checked_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.adapter_registry TO authenticated;
GRANT ALL ON public.adapter_registry TO service_role;
ALTER TABLE public.adapter_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "adapters readable" ON public.adapter_registry FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage adapters" ON public.adapter_registry FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.adapter_registry (adapter, label) VALUES
 ('greenhouse','Greenhouse'), ('lever','Lever'), ('ashby','Ashby'), ('workable','Workable'), ('unsupported','Unsupported');

-- ============ MATCHING ============
CREATE TABLE public.job_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  match_score numeric NOT NULL,
  role_score numeric,
  skills_score numeric,
  experience_score numeric,
  location_score numeric,
  seniority_score numeric,
  preferences_score numeric,
  hard_requirements_met boolean NOT NULL DEFAULT false,
  explanation jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, job_id)
);
GRANT SELECT ON public.job_matches TO authenticated;
GRANT ALL ON public.job_matches TO service_role;
ALTER TABLE public.job_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own matches" ON public.job_matches FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ============ CV VARIANTS ============
CREATE TABLE public.resume_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  base_resume_path text,
  structured_resume jsonb NOT NULL DEFAULT '{}'::jsonb,
  professional_summary text,
  selected_experience_ids uuid[] NOT NULL DEFAULT '{}',
  selected_skill_ids uuid[] NOT NULL DEFAULT '{}',
  generated_bullets jsonb NOT NULL DEFAULT '[]'::jsonb,
  html text,
  pdf_path text,
  generation_model text,
  validation_status text NOT NULL DEFAULT 'pending',
  validation_issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.resume_variants TO authenticated;
GRANT ALL ON public.resume_variants TO service_role;
ALTER TABLE public.resume_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own resume variants" ON public.resume_variants FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ============ ATTEMPTS / QUEUE / BATCHES ============
CREATE TABLE public.application_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  total_selected integer NOT NULL DEFAULT 0,
  queued_count integer NOT NULL DEFAULT 0,
  processing_count integer NOT NULL DEFAULT 0,
  verified_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
GRANT SELECT ON public.application_batches TO authenticated;
GRANT ALL ON public.application_batches TO service_role;
ALTER TABLE public.application_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own batches" ON public.application_batches FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.application_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  batch_id uuid REFERENCES public.application_batches(id) ON DELETE SET NULL,
  resume_variant_id uuid REFERENCES public.resume_variants(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'queued',
  attempt_number integer NOT NULL DEFAULT 1,
  adapter text,
  adapter_version text,
  queued_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  submitted_at timestamptz,
  verified_at timestamptz,
  error_code text,
  error_message text,
  submission_reference text,
  evidence_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.application_attempts TO authenticated;
GRANT ALL ON public.application_attempts TO service_role;
ALTER TABLE public.application_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own attempts" ON public.application_attempts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE UNIQUE INDEX application_attempts_verified_unique ON public.application_attempts (user_id, job_id) WHERE status = 'verified';
CREATE INDEX application_attempts_user_idx ON public.application_attempts (user_id, status);

CREATE TABLE public.application_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  attempt_id uuid REFERENCES public.application_attempts(id) ON DELETE CASCADE,
  batch_id uuid REFERENCES public.application_batches(id) ON DELETE SET NULL,
  priority integer NOT NULL DEFAULT 100,
  status text NOT NULL DEFAULT 'queued',
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  worker_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, job_id)
);
GRANT SELECT ON public.application_queue TO authenticated;
GRANT ALL ON public.application_queue TO service_role;
ALTER TABLE public.application_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own queue" ON public.application_queue FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX application_queue_claim_idx ON public.application_queue (status, next_attempt_at, priority);

CREATE TABLE public.application_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_attempt_id uuid NOT NULL REFERENCES public.application_attempts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  resume_variant_id uuid REFERENCES public.resume_variants(id) ON DELETE SET NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  profile_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  job_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.application_snapshots TO authenticated;
GRANT ALL ON public.application_snapshots TO service_role;
ALTER TABLE public.application_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own snapshots" ON public.application_snapshots FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.application_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  job_id uuid,
  application_attempt_id uuid,
  event_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.application_audit_log TO authenticated;
GRANT ALL ON public.application_audit_log TO service_role;
ALTER TABLE public.application_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own audit log" ON public.application_audit_log FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ============ BILLING ============
CREATE TABLE public.plans (
  code text PRIMARY KEY,
  name text NOT NULL,
  weekly_application_limit integer NOT NULL,
  price_amount numeric NOT NULL,
  price_currency text NOT NULL DEFAULT 'USD',
  billing_period text NOT NULL DEFAULT 'week',
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0
);
GRANT SELECT ON public.plans TO authenticated, anon;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans readable" ON public.plans FOR SELECT TO authenticated, anon USING (active);

INSERT INTO public.plans (code, name, weekly_application_limit, price_amount, sort_order) VALUES
 ('starter','Starter',25,9,1), ('pro','Pro',100,19,2), ('max','Max',250,39,3);

CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  plan_code text REFERENCES public.plans(code),
  status text NOT NULL DEFAULT 'inactive',
  current_period_start timestamptz,
  current_period_end timestamptz,
  provider text,
  provider_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own subscription" ON public.subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER subscriptions_touch BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.application_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  granted integer NOT NULL DEFAULT 0,
  consumed integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, period_start)
);
GRANT SELECT ON public.application_credits TO authenticated;
GRANT ALL ON public.application_credits TO service_role;
ALTER TABLE public.application_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own credits" ON public.application_credits FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ============ QUEUE FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.enqueue_application(_user_id uuid, _job_id uuid, _batch_id uuid DEFAULT NULL, _priority integer DEFAULT 100)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _consent boolean; _eligible boolean; _attempt uuid;
BEGIN
  SELECT authorized INTO _consent FROM public.auto_apply_consents WHERE user_id = _user_id AND revoked_at IS NULL;
  IF _consent IS NOT TRUE THEN RETURN 'consent_missing'; END IF;

  SELECT auto_apply_eligible AND is_active INTO _eligible FROM public.jobs WHERE id = _job_id;
  IF _eligible IS NOT TRUE THEN RETURN 'unsupported'; END IF;

  IF EXISTS (SELECT 1 FROM public.application_attempts WHERE user_id = _user_id AND job_id = _job_id AND status = 'verified') THEN
    RETURN 'duplicate';
  END IF;
  IF EXISTS (SELECT 1 FROM public.application_queue WHERE user_id = _user_id AND job_id = _job_id) THEN
    RETURN 'duplicate';
  END IF;

  INSERT INTO public.application_attempts (user_id, job_id, batch_id, status, adapter)
  SELECT _user_id, _job_id, _batch_id, 'queued', j.auto_apply_adapter FROM public.jobs j WHERE j.id = _job_id
  RETURNING id INTO _attempt;

  INSERT INTO public.application_queue (user_id, job_id, attempt_id, batch_id, priority)
  VALUES (_user_id, _job_id, _attempt, _batch_id, _priority);

  INSERT INTO public.application_audit_log (user_id, job_id, application_attempt_id, event_type)
  VALUES (_user_id, _job_id, _attempt, 'application_queued');

  IF _batch_id IS NOT NULL THEN
    UPDATE public.application_batches SET queued_count = queued_count + 1 WHERE id = _batch_id;
  END IF;
  RETURN 'queued';
END; $$;
REVOKE ALL ON FUNCTION public.enqueue_application(uuid,uuid,uuid,integer) FROM public;
GRANT EXECUTE ON FUNCTION public.enqueue_application(uuid,uuid,uuid,integer) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_application(_worker_id text, _limit integer DEFAULT 1)
RETURNS SETOF public.application_queue LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT id FROM public.application_queue
    WHERE status = 'queued' AND next_attempt_at <= now()
    ORDER BY priority ASC, created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT _limit
  )
  UPDATE public.application_queue q
  SET status = 'processing', locked_at = now(), worker_id = _worker_id, attempts = q.attempts + 1
  FROM picked WHERE q.id = picked.id
  RETURNING q.*;
END; $$;
REVOKE ALL ON FUNCTION public.claim_application(text,integer) FROM public;
GRANT EXECUTE ON FUNCTION public.claim_application(text,integer) TO service_role;

CREATE OR REPLACE FUNCTION public.complete_application(_queue_id uuid, _submission_reference text, _evidence_path text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _q public.application_queue; _week_start date;
BEGIN
  SELECT * INTO _q FROM public.application_queue WHERE id = _queue_id FOR UPDATE;
  IF _q.id IS NULL THEN RETURN 'not_found'; END IF;

  UPDATE public.application_attempts
  SET status = 'verified', submitted_at = COALESCE(submitted_at, now()), verified_at = now(),
      submission_reference = _submission_reference, evidence_path = _evidence_path
  WHERE id = _q.attempt_id;

  _week_start := date_trunc('week', now())::date;
  INSERT INTO public.application_credits (user_id, period_start, period_end, granted, consumed)
  VALUES (_q.user_id, _week_start, _week_start + 6, 0, 1)
  ON CONFLICT (user_id, period_start) DO UPDATE SET consumed = public.application_credits.consumed + 1, updated_at = now();

  INSERT INTO public.application_audit_log (user_id, job_id, application_attempt_id, event_type)
  VALUES (_q.user_id, _q.job_id, _q.attempt_id, 'submission_verified'),
         (_q.user_id, _q.job_id, _q.attempt_id, 'credit_consumed');

  IF _q.batch_id IS NOT NULL THEN
    UPDATE public.application_batches SET verified_count = verified_count + 1, queued_count = GREATEST(queued_count - 1, 0) WHERE id = _q.batch_id;
  END IF;

  DELETE FROM public.application_queue WHERE id = _queue_id;
  RETURN 'verified';
END; $$;
REVOKE ALL ON FUNCTION public.complete_application(uuid,text,text) FROM public;
GRANT EXECUTE ON FUNCTION public.complete_application(uuid,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.retry_application(_queue_id uuid, _delay_seconds integer DEFAULT 300, _error_code text DEFAULT NULL, _error_message text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _q public.application_queue;
BEGIN
  SELECT * INTO _q FROM public.application_queue WHERE id = _queue_id FOR UPDATE;
  IF _q.id IS NULL THEN RETURN 'not_found'; END IF;
  UPDATE public.application_queue
  SET status = 'queued', locked_at = NULL, worker_id = NULL, next_attempt_at = now() + make_interval(secs => _delay_seconds)
  WHERE id = _queue_id;
  UPDATE public.application_attempts
  SET status = 'failed_retryable', error_code = _error_code, error_message = _error_message
  WHERE id = _q.attempt_id;
  RETURN 'retry_scheduled';
END; $$;
REVOKE ALL ON FUNCTION public.retry_application(uuid,integer,text,text) FROM public;
GRANT EXECUTE ON FUNCTION public.retry_application(uuid,integer,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.fail_application(_queue_id uuid, _error_code text, _error_message text, _status text DEFAULT 'failed_permanent')
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _q public.application_queue;
BEGIN
  SELECT * INTO _q FROM public.application_queue WHERE id = _queue_id FOR UPDATE;
  IF _q.id IS NULL THEN RETURN 'not_found'; END IF;
  UPDATE public.application_attempts
  SET status = _status, error_code = _error_code, error_message = _error_message
  WHERE id = _q.attempt_id;
  INSERT INTO public.application_audit_log (user_id, job_id, application_attempt_id, event_type, metadata)
  VALUES (_q.user_id, _q.job_id, _q.attempt_id, 'submission_failed', jsonb_build_object('error_code', _error_code));
  IF _q.batch_id IS NOT NULL THEN
    UPDATE public.application_batches SET failed_count = failed_count + 1, queued_count = GREATEST(queued_count - 1, 0) WHERE id = _q.batch_id;
  END IF;
  DELETE FROM public.application_queue WHERE id = _queue_id;
  RETURN _status;
END; $$;
REVOKE ALL ON FUNCTION public.fail_application(uuid,text,text,text) FROM public;
GRANT EXECUTE ON FUNCTION public.fail_application(uuid,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.update_attempt_status(_queue_id uuid, _status text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _q public.application_queue;
BEGIN
  SELECT * INTO _q FROM public.application_queue WHERE id = _queue_id;
  IF _q.id IS NULL THEN RETURN 'not_found'; END IF;
  UPDATE public.application_attempts SET status = _status,
    started_at = CASE WHEN started_at IS NULL THEN now() ELSE started_at END,
    submitted_at = CASE WHEN _status = 'submitted_unverified' THEN now() ELSE submitted_at END
  WHERE id = _q.attempt_id;
  RETURN _status;
END; $$;
REVOKE ALL ON FUNCTION public.update_attempt_status(uuid,text) FROM public;
GRANT EXECUTE ON FUNCTION public.update_attempt_status(uuid,text) TO service_role;

-- ============ REALTIME ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.application_attempts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.application_batches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.application_queue;