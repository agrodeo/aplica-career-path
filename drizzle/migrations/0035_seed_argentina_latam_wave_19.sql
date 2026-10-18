-- Argentina + LATAM expansion wave 19.
-- Adds current SmartRecruiters boards with verified Buenos Aires / Argentina hiring.

WITH seed(name, careers_url, ats_type, ats_identifier) AS (
  VALUES
    ('Endava', 'https://jobs.smartrecruiters.com/Endava', 'smartrecruiters', 'Endava'),
    ('Blend360', 'https://jobs.smartrecruiters.com/Blend360', 'smartrecruiters', 'Blend360'),
    ('Software Mind', 'https://jobs.smartrecruiters.com/SoftwareMind', 'smartrecruiters', 'SoftwareMind'),
    ('Louis Dreyfus Company', 'https://jobs.smartrecruiters.com/LouisDreyfusCompany', 'smartrecruiters', 'LouisDreyfusCompany'),
    ('PSI CRO', 'https://jobs.smartrecruiters.com/psicro', 'smartrecruiters', 'psicro'),
    ('TGLT', 'https://jobs.smartrecruiters.com/TGLT', 'smartrecruiters', 'TGLT')
)
INSERT INTO public.companies (
  name, careers_url, ats_type, ats_identifier, auto_apply_supported, active
)
SELECT
  s.name,
  s.careers_url,
  s.ats_type,
  s.ats_identifier,
  true,
  true
FROM seed s
WHERE NOT EXISTS (
  SELECT 1
  FROM public.companies c
  WHERE c.ats_type = s.ats_type
    AND lower(c.ats_identifier) = lower(s.ats_identifier)
);
