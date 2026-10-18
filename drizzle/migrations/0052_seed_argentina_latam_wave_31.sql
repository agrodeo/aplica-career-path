-- Argentina + LATAM expansion wave 31.
-- Adds large and LATAM-friendly boards and fixes Superhuman's ATS mapping.

UPDATE public.companies
SET
  careers_url = 'https://jobs.ashbyhq.com/superhuman%20platform%20inc',
  ats_type = 'ashby',
  ats_identifier = 'superhuman platform inc',
  auto_apply_supported = true,
  active = true,
  last_scanned_at = null
WHERE lower(name) = 'superhuman'
  AND lower(coalesce(ats_identifier,'')) = 'grammarly';

WITH seed(name, careers_url, ats_type, ats_identifier) AS (
  VALUES
    ('Wishpond Technologies', 'https://jobs.lever.co/wishpond', 'lever', 'wishpond'),
    ('Appen', 'https://jobs.lever.co/appen-2', 'lever', 'appen-2'),
    ('Gratia', 'https://jobs.ashbyhq.com/gratia', 'ashby', 'gratia'),
    ('Express Chipping', 'https://jobs.lever.co/chipping-concrete', 'lever', 'chipping-concrete')
)
INSERT INTO public.companies (
  name, careers_url, ats_type, ats_identifier, auto_apply_supported, active
)
SELECT s.name,s.careers_url,s.ats_type,s.ats_identifier,true,true
FROM seed s
WHERE NOT EXISTS (
  SELECT 1
  FROM public.companies c
  WHERE c.ats_type=s.ats_type
    AND lower(c.ats_identifier)=lower(s.ats_identifier)
);