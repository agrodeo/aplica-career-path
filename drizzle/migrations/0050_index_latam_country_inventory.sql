CREATE INDEX IF NOT EXISTS jobs_active_country_company_idx
ON public.jobs (country, company_id)
WHERE is_active = true;
