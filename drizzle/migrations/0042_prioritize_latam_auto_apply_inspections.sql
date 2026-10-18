CREATE INDEX IF NOT EXISTS jobs_application_url_idx
ON public.jobs (application_url)
WHERE application_url IS NOT NULL;

CREATE OR REPLACE FUNCTION public.claim_inspection(_worker_id text, _limit integer DEFAULT 1)
RETURNS SETOF public.adapter_inspections
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT ai.id
    FROM public.adapter_inspections ai
    WHERE ai.status = 'queued'
    ORDER BY
      CASE
        WHEN ai.url ILIKE '%greenhouse.io/%' THEN 1
        WHEN ai.url ILIKE '%ashbyhq.com/%' THEN 2
        WHEN ai.url ILIKE '%workable.com/%' THEN 3
        WHEN ai.url ILIKE '%smartrecruiters.com/%' THEN 4
        WHEN ai.url ILIKE '%myworkdayjobs.com/%' THEN 5
        WHEN ai.url ILIKE '%lever.co/%' THEN 6
        ELSE 7
      END,
      CASE WHEN EXISTS (
        SELECT 1
        FROM public.jobs j
        WHERE j.application_url = ai.url
          AND j.is_active = true
          AND (
            j.country IN ('ar','bo','br','cl','co','cr','do','ec','gt','hn','mx','ni','pa','pe','pr','py','sv','uy','ve')
            OR lower(coalesce(j.location,'')) ~ 'latin america|latam|south america'
          )
      ) THEN 0 ELSE 1 END,
      ai.created_at ASC
    FOR UPDATE OF ai SKIP LOCKED
    LIMIT LEAST(GREATEST(_limit, 1), 120)
  )
  UPDATE public.adapter_inspections i
  SET status = 'running',
      locked_at = now(),
      worker_id = _worker_id
  FROM picked
  WHERE i.id = picked.id
  RETURNING i.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_inspection(text,integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_inspection(text,integer) TO service_role;