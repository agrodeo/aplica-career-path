CREATE OR REPLACE FUNCTION public.claim_inspection(_worker_id text, _limit integer DEFAULT 1)
RETURNS SETOF public.adapter_inspections
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT id
    FROM public.adapter_inspections
    WHERE status = 'queued'
    ORDER BY
      CASE
        WHEN url ILIKE '%greenhouse.io/%' THEN 1
        WHEN url ILIKE '%ashbyhq.com/%' THEN 2
        WHEN url ILIKE '%workable.com/%' THEN 3
        WHEN url ILIKE '%myworkdayjobs.com/%' THEN 4
        WHEN url ILIKE '%lever.co/%' THEN 5
        WHEN url ILIKE '%smartrecruiters.com/%' THEN 6
        ELSE 7
      END,
      created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(_limit, 1), 30)
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
