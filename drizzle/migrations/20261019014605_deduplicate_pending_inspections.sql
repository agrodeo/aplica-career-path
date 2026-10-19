SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='120s';
LOCK TABLE public.adapter_inspections IN SHARE ROW EXCLUSIVE MODE;
-- Keep an audit trail and the oldest lease/queued request. Do not change jobs
-- or terminate active workers while removing redundant pending work.
WITH ranked AS (
  SELECT id,row_number() OVER (PARTITION BY url ORDER BY (status='running') DESC,created_at,id) AS position
  FROM public.adapter_inspections WHERE status IN ('queued','running')
)
UPDATE public.adapter_inspections i SET status='failed',completed_at=now(),
  error_code='DUPLICATE_INSPECTION',error_message='Superseded by an existing pending inspection for the same URL'
FROM ranked r WHERE i.id=r.id AND r.position>1 AND i.status='queued';

CREATE UNIQUE INDEX IF NOT EXISTS adapter_inspections_one_pending_url_idx
ON public.adapter_inspections(url) WHERE status IN ('queued','running');

CREATE OR REPLACE FUNCTION public.enqueue_job_inspections(_requested_by uuid,_urls text[],_adapter text,_ats_type text)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE _inserted integer;
BEGIN
  IF cardinality(_urls)>100 THEN RAISE EXCEPTION 'Inspection intake limited to 100 URLs per call'; END IF;
  INSERT INTO public.adapter_inspections(requested_by,url,mode,status,adapter,ats_type)
    SELECT _requested_by,u.url,'inspect','queued',_adapter,_ats_type
    FROM (SELECT DISTINCT unnest(_urls) AS url) u WHERE nullif(trim(u.url),'') IS NOT NULL
    ORDER BY u.url
    ON CONFLICT (url) WHERE status IN ('queued','running') DO NOTHING;
  GET DIAGNOSTICS _inserted = ROW_COUNT;
  RETURN _inserted;
END; $$;
REVOKE ALL ON FUNCTION public.enqueue_job_inspections(uuid,text[],text,text) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_job_inspections(uuid,text[],text,text) TO service_role;
