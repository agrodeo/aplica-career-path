ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS latam_priority boolean NOT NULL DEFAULT false;

UPDATE public.companies c
SET latam_priority = true
WHERE EXISTS (
  SELECT 1
  FROM public.jobs j
  WHERE j.company_id = c.id
    AND j.is_active = true
    AND j.country IN ('ar','bo','br','cl','co','cr','do','ec','gt','hn','mx','ni','pa','pe','pr','py','sv','uy','ve')
);

CREATE INDEX IF NOT EXISTS companies_latam_priority_scan_idx
ON public.companies (latam_priority, last_scanned_at)
WHERE active = true;
