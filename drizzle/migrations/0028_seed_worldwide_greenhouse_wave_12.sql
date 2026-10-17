-- Worldwide Greenhouse expansion wave 12.
-- High-volume, currently live public boards prioritized because Greenhouse has
-- the strongest verified Auto Apply inspection pass rate in current production.

WITH seed(name, careers_url, ats_type, ats_identifier) AS (
  VALUES
    ('Anduril Industries', 'https://job-boards.greenhouse.io/andurilindustries', 'greenhouse', 'andurilindustries'),
    ('Verkada', 'https://job-boards.greenhouse.io/verkada', 'greenhouse', 'verkada'),
    ('Anthropic', 'https://job-boards.greenhouse.io/anthropic', 'greenhouse', 'anthropic'),
    ('DEPT', 'https://job-boards.greenhouse.io/dept', 'greenhouse', 'dept'),
    ('Breeze', 'https://job-boards.greenhouse.io/breezecash', 'greenhouse', 'breezecash')
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
