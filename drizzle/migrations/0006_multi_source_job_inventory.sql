-- Discovery and Auto Apply are separate capabilities.
-- Authenticated users may browse every active job, while enqueue_application
-- still enforces auto_apply_eligible before anything can be submitted.

DROP POLICY IF EXISTS "auto apply inventory readable" ON public.jobs;

CREATE POLICY "active jobs readable"
ON public.jobs
FOR SELECT
TO authenticated
USING (is_active);

CREATE INDEX IF NOT EXISTS jobs_active_discovered_idx
ON public.jobs (is_active, discovered_at DESC);

CREATE INDEX IF NOT EXISTS companies_active_ats_idx
ON public.companies (active, ats_type, last_scanned_at);
