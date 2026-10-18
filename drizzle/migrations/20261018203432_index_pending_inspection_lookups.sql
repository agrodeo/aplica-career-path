-- Fail promptly on busy tables rather than holding up API recovery. This
-- migration can be retried without changing data or duplicating indexes.
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
CREATE INDEX IF NOT EXISTS adapter_inspections_pending_url_idx
  ON public.adapter_inspections (url) WHERE status IN ('queued','running');
CREATE INDEX IF NOT EXISTS adapter_inspections_worker_idx
  ON public.adapter_inspections (worker_id) WHERE worker_id IS NOT NULL;
