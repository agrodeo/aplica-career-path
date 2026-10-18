-- Argentina + LATAM expansion wave 29.
WITH seed(name, careers_url, ats_type, ats_identifier) AS (
  VALUES
    ('inBeat Agency', 'https://jobs.ashbyhq.com/inbeat-agency', 'ashby', 'inbeat-agency'),
    ('FS Studio', 'https://jobs.ashbyhq.com/fs-studio', 'ashby', 'fs-studio')
)
INSERT INTO public.companies (name,careers_url,ats_type,ats_identifier,auto_apply_supported,active)
SELECT s.name,s.careers_url,s.ats_type,s.ats_identifier,true,true
FROM seed s
WHERE NOT EXISTS (
  SELECT 1 FROM public.companies c
  WHERE c.ats_type=s.ats_type AND lower(c.ats_identifier)=lower(s.ats_identifier)
);