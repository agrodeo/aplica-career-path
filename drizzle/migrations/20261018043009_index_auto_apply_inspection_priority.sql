-- Match the queue ordering with a partial index. Claims previously sorted the
-- entire backlog and ran a correlated region lookup for every queued row.
CREATE INDEX IF NOT EXISTS adapter_inspections_ats_claim_idx
ON public.adapter_inspections ((CASE
  WHEN url ILIKE '%greenhouse.io/%' THEN 1
  WHEN url ILIKE '%ashbyhq.com/%' THEN 2
  WHEN url ILIKE '%workable.com/%' THEN 3
  WHEN url ILIKE '%smartrecruiters.com/%' THEN 4
  WHEN url ILIKE '%myworkdayjobs.com/%' THEN 5
  WHEN url ILIKE '%lever.co/%' THEN 6 ELSE 7 END), created_at, id)
WHERE status = 'queued';

