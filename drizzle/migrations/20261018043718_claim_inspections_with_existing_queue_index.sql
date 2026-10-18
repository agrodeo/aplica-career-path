-- Read a bounded oldest-first window through the existing (status, created_at) index.
-- ATS and regional priority are applied within that window, so every provider advances.
CREATE OR REPLACE FUNCTION public.claim_inspection(_worker_id text, _limit integer DEFAULT 1)
RETURNS SETOF public.adapter_inspections
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- A runner is killed after 20 minutes. Its abandoned leases must be reusable.
  UPDATE public.adapter_inspections SET status = 'queued', worker_id = NULL, locked_at = NULL
  WHERE status = 'running' AND locked_at < now() - interval '25 minutes';
  RETURN QUERY
  WITH candidates AS MATERIALIZED (
    SELECT ai.id, ai.url, ai.created_at,
      CASE WHEN ai.url ILIKE '%greenhouse.io/%' THEN 1
        WHEN ai.url ILIKE '%ashbyhq.com/%' THEN 2
        WHEN ai.url ILIKE '%workable.com/%' THEN 3
        WHEN ai.url ILIKE '%smartrecruiters.com/%' THEN 4
        WHEN ai.url ILIKE '%myworkdayjobs.com/%' THEN 5
        WHEN ai.url ILIKE '%lever.co/%' THEN 6 ELSE 7 END AS ats_priority
    FROM public.adapter_inspections ai WHERE ai.status = 'queued'
    ORDER BY ai.created_at
    LIMIT LEAST(GREATEST(_limit, 1), 120) * 4
    FOR UPDATE OF ai SKIP LOCKED
  ), picked AS (
    SELECT c.id FROM candidates c
    ORDER BY c.ats_priority,
      CASE WHEN EXISTS (
        SELECT 1 FROM public.jobs j WHERE j.application_url = c.url AND j.is_active
        AND (j.country IN ('ar','bo','br','cl','co','cr','do','ec','gt','hn','mx','ni','pa','pe','pr','py','sv','uy','ve')
          OR lower(coalesce(j.location,'')) ~ 'latin america|latam|south america')
      ) THEN 0 ELSE 1 END, c.created_at, c.id
    LIMIT LEAST(GREATEST(_limit, 1), 120)
  )
  UPDATE public.adapter_inspections i SET status = 'running', locked_at = now(), worker_id = _worker_id
  FROM picked WHERE i.id = picked.id RETURNING i.*;
END; $$;
REVOKE ALL ON FUNCTION public.claim_inspection(text,integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_inspection(text,integer) TO service_role;
