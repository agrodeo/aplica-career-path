-- Run after deploying the matching adapter versions. Adds at most 600 public
-- inspection requests, retaining existing results and active inspection leases.
WITH actor AS (
  SELECT requested_by FROM public.adapter_inspections ORDER BY created_at DESC LIMIT 1
), providers(ats_type, adapter, version) AS (
  VALUES ('greenhouse','greenhouse_public_form','1.4.0'),
         ('ashby','ashby_public_form','0.4.0'),
         ('workable','workable_public_form','0.4.0')
), candidates AS (
  SELECT p.ats_type,p.adapter,c.application_url
  FROM providers p CROSS JOIN LATERAL (
    SELECT j.application_url FROM public.jobs j
    LEFT JOIN public.application_schemas s ON s.id=j.application_schema_id
    WHERE j.is_active AND j.ats_type=p.ats_type AND j.application_url IS NOT NULL
      AND s.schema_version IS DISTINCT FROM p.version
      AND coalesce(j.ineligibility_reason,'') !~* 'captcha|login|automation_blocked'
      AND NOT EXISTS (SELECT 1 FROM public.adapter_inspections i
        WHERE i.url=j.application_url AND i.status IN ('queued','running'))
    ORDER BY j.auto_apply_eligible, public.job_inspection_priority(j.country,j.location,j.remote_type,j.published_at) DESC,j.discovered_at DESC
    LIMIT 200
  ) c
), inserted AS (
  INSERT INTO public.adapter_inspections(requested_by,url,mode,status,adapter,ats_type)
  SELECT a.requested_by,c.application_url,'inspect','queued',c.adapter,c.ats_type
  FROM candidates c CROSS JOIN actor a
  ON CONFLICT (url) WHERE status IN ('queued','running') DO NOTHING
  RETURNING ats_type
)
SELECT ats_type,count(*) AS queued FROM inserted GROUP BY ats_type ORDER BY ats_type;
