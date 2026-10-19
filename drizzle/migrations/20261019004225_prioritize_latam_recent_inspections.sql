SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '90s';

ALTER TABLE public.adapter_inspections ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 0;

-- Keep these weights aligned with job-sources/discovery-policy.ts. Unknown
-- publication dates are an exploration bucket, never evidence of recency.
CREATE OR REPLACE FUNCTION public.job_inspection_priority(
  _country text, _location text, _remote_type text, _published_at timestamptz,
  _now timestamptz DEFAULT now()
) RETURNS integer LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT
    CASE WHEN lower(coalesce(_country,'')) = ANY(ARRAY['ar','bo','br','cl','co','cr','cu','do','ec','sv','gt','ht','hn','mx','ni','pa','py','pe','pr','uy','ve'])
        OR coalesce(_location,'') ~* '\mlatam\M|latin america|south america|américa latina|america latina' THEN 1000
      WHEN nullif(_country,'') IS NULL AND _remote_type='remote'
        AND coalesce(_location,'') ~* '\m(worldwide|anywhere|global)\M' THEN 600 ELSE 0 END
    + CASE WHEN _published_at IS NULL OR _published_at > _now THEN 50
      WHEN _published_at >= _now-interval '7 days' THEN 300
      WHEN _published_at >= _now-interval '30 days' THEN 200
      WHEN _published_at >= _now-interval '90 days' THEN 100 ELSE 0 END;
$$;

CREATE OR REPLACE FUNCTION public.set_inspection_priority()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  SELECT coalesce(max(public.job_inspection_priority(j.country,j.location,j.remote_type,j.published_at)),0)
    INTO NEW.priority FROM public.jobs j WHERE j.application_url=NEW.url AND j.is_active;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS inspection_priority_on_insert ON public.adapter_inspections;
CREATE TRIGGER inspection_priority_on_insert BEFORE INSERT OR UPDATE OF url
  ON public.adapter_inspections FOR EACH ROW EXECUTE FUNCTION public.set_inspection_priority();

-- Reorder the backlog too: otherwise the new policy would only affect new rows.
WITH scores AS (
  SELECT application_url, max(public.job_inspection_priority(country,location,remote_type,published_at)) AS priority
  FROM public.jobs WHERE is_active AND application_url IS NOT NULL GROUP BY application_url
)
UPDATE public.adapter_inspections i SET priority=s.priority FROM scores s
WHERE i.url=s.application_url AND i.status='queued' AND i.priority IS DISTINCT FROM s.priority;

CREATE INDEX IF NOT EXISTS adapter_inspections_priority_claim_idx
  ON public.adapter_inspections (ats_type,priority DESC,created_at,id) WHERE status='queued';

-- Refresh scores when a source is scanned, so age buckets do not stay frozen
-- at the time a listing first entered the queue.
CREATE OR REPLACE FUNCTION public.refresh_source_inspection_priorities(_source_id uuid)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  WITH scores AS (
    SELECT application_url,max(public.job_inspection_priority(country,location,remote_type,published_at)) AS priority
    FROM public.jobs WHERE source_id=_source_id AND is_active AND application_url IS NOT NULL GROUP BY application_url
  ) UPDATE public.adapter_inspections i SET priority=s.priority FROM scores s
    WHERE i.url=s.application_url AND i.status='queued' AND i.priority IS DISTINCT FROM s.priority;
$$;
REVOKE ALL ON FUNCTION public.refresh_source_inspection_priorities(uuid) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_source_inspection_priorities(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_inspection_batch(_worker_id text, _limit integer DEFAULT 1, _ats_type text DEFAULT NULL)
RETURNS SETOF public.adapter_inspections
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  _provider text := _ats_type;
  _batch integer := LEAST(GREATEST(_limit,1),120);
  _preferred integer;
BEGIN
  IF nullif(trim(_worker_id),'') IS NULL THEN RAISE EXCEPTION 'Worker ID required'; END IF;
  IF _provider IS NOT NULL AND _provider NOT IN ('greenhouse','ashby','workable','smartrecruiters','workday','lever') THEN
    RAISE EXCEPTION 'Unsupported inspection provider';
  END IF;
  UPDATE public.adapter_inspections SET status='queued',worker_id=NULL,locked_at=NULL
    WHERE status='running' AND locked_at < now()-interval '25 minutes';
  IF EXISTS (SELECT 1 FROM public.adapter_inspections WHERE status='running' AND worker_id=_worker_id) THEN
    RETURN QUERY SELECT i.* FROM public.adapter_inspections i WHERE i.status='running' AND i.worker_id=_worker_id
      ORDER BY i.created_at,i.id LIMIT _batch;
    RETURN;
  END IF;
  IF _provider IS NULL THEN
    SELECT p.provider INTO _provider FROM unnest(ARRAY['greenhouse','ashby','workable','smartrecruiters','workday','lever'])
      WITH ORDINALITY AS p(provider,priority)
      WHERE EXISTS (SELECT 1 FROM public.adapter_inspections i WHERE i.status='queued' AND i.ats_type=p.provider)
      ORDER BY p.priority LIMIT 1;
  END IF;
  -- Most capacity goes to relevant/fresh jobs. Reserve one fifth for oldest
  -- queued work so worldwide and unknown-date listings cannot starve forever.
  _preferred := CASE WHEN _batch=1 THEN 1 ELSE greatest(1,floor(_batch*0.8)::integer) END;
  RETURN QUERY WITH preferred AS MATERIALIZED (
    SELECT i.id FROM public.adapter_inspections i WHERE i.status='queued' AND i.ats_type=_provider
    ORDER BY i.priority DESC,i.created_at,i.id FOR UPDATE SKIP LOCKED LIMIT _preferred
  ), exploration AS MATERIALIZED (
    SELECT i.id FROM public.adapter_inspections i WHERE i.status='queued' AND i.ats_type=_provider
      AND i.id NOT IN (SELECT p.id FROM preferred p)
    ORDER BY i.created_at,i.id FOR UPDATE SKIP LOCKED LIMIT _batch-(SELECT count(*) FROM preferred)
  ), picked AS (SELECT id FROM preferred UNION ALL SELECT id FROM exploration)
  UPDATE public.adapter_inspections i SET status='running',worker_id=_worker_id,locked_at=now()
    FROM picked WHERE i.id=picked.id RETURNING i.*;
END; $$;
REVOKE ALL ON FUNCTION public.claim_inspection_batch(text,integer,text) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_inspection_batch(text,integer,text) TO service_role;
