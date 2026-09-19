-- Discovery inventory is broader than Auto Apply inventory.
-- Authenticated users may read active jobs for matching/manual application.
-- Queue creation still explicitly requires auto_apply_eligible=true.

DROP POLICY IF EXISTS "auto apply inventory readable" ON public.jobs;
DROP POLICY IF EXISTS "active jobs readable" ON public.jobs;

CREATE POLICY "active jobs readable"
ON public.jobs
FOR SELECT
TO authenticated
USING (is_active);

CREATE INDEX IF NOT EXISTS jobs_active_discovery_idx
ON public.jobs (is_active, ats_type, published_at DESC);
