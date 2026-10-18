-- PostgREST builds its schema cache as authenticator, before switching to a
-- request role. Allow that initialization the same bounded budget as workers.
-- anon (3s) and authenticated (8s) retain their explicit per-role limits.
ALTER ROLE authenticator SET statement_timeout = '30s';

-- Inventory checks pending URLs and workers recover their own leases. Keep
-- both lookups off the full growing inspection heap.
CREATE INDEX IF NOT EXISTS adapter_inspections_pending_url_idx
  ON public.adapter_inspections (url) WHERE status IN ('queued','running');
CREATE INDEX IF NOT EXISTS adapter_inspections_worker_idx
  ON public.adapter_inspections (worker_id) WHERE worker_id IS NOT NULL;
NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
