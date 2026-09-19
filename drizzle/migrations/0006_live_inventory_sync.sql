-- Live inventory freshness and scheduled discovery support.

ALTER TABLE public.adapter_inspections
  ALTER COLUMN requested_by DROP NOT NULL;

ALTER TABLE public.jobs
  ADD COLUMN source_updated_at timestamptz;

CREATE INDEX jobs_source_updated_idx
  ON public.jobs (source_updated_at DESC)
  WHERE is_active = true;

ALTER TABLE public.job_sources
  ADD COLUMN last_synced_at timestamptz,
  ADD COLUMN last_sync_status text NOT NULL DEFAULT 'never',
  ADD COLUMN last_sync_error text,
  ADD COLUMN last_job_count integer NOT NULL DEFAULT 0;

CREATE INDEX job_sources_discovery_due_idx
  ON public.job_sources (discovery_enabled, active, last_synced_at);
