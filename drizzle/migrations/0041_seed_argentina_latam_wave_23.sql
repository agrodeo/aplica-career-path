-- Argentina + LATAM expansion wave 23.
-- Live public ATS boards with current Argentina / Buenos Aires / LATAM hiring.

WITH seed(name, careers_url, ats_type, ats_identifier) AS (
  VALUES
    ('Cabify', 'https://job-boards.greenhouse.io/cabify', 'greenhouse', 'cabify'),
    ('Backblaze', 'https://job-boards.greenhouse.io/backblaze', 'greenhouse', 'backblaze'),
    ('Fluxon', 'https://job-boards.greenhouse.io/fluxon', 'greenhouse', 'fluxon'),
    ('Cloudbeds', 'https://job-boards.greenhouse.io/cloudbedsthirdpartyboard', 'greenhouse', 'cloudbedsthirdpartyboard'),
    ('Episode Six', 'https://job-boards.greenhouse.io/episodesix', 'greenhouse', 'episodesix'),
    ('IPSY', 'https://job-boards.greenhouse.io/personalizedbeautydiscoveryincdbaipsy', 'greenhouse', 'personalizedbeautydiscoveryincdbaipsy'),
    ('Upgrade', 'https://job-boards.greenhouse.io/upgrade', 'greenhouse', 'upgrade'),
    ('Newsela', 'https://job-boards.greenhouse.io/newsela', 'greenhouse', 'newsela'),
    ('Cresteo', 'https://job-boards.greenhouse.io/cresteo', 'greenhouse', 'cresteo'),
    ('Webflow', 'https://job-boards.greenhouse.io/webflow', 'greenhouse', 'webflow'),
    ('Webstacks', 'https://job-boards.greenhouse.io/webstacks', 'greenhouse', 'webstacks'),
    ('Praxent', 'https://job-boards.greenhouse.io/praxent', 'greenhouse', 'praxent'),
    ('Xepelin', 'https://jobs.lever.co/xepelin', 'lever', 'xepelin'),
    ('redbee', 'https://jobs.lever.co/redbee', 'lever', 'redbee'),
    ('bet365', 'https://jobs.smartrecruiters.com/bet3651', 'smartrecruiters', 'bet3651')
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