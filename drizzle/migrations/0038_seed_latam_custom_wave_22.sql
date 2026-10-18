-- LATAM custom careers wave 22.
-- Discovery-only sources. Submission stays disabled until a dedicated adapter is verified.

WITH seed(name, careers_url, ats_type, ats_identifier) AS (
  VALUES
    ('Rappi', 'https://careers.rappi.com/es/careers', 'custom', 'rappi'),
    ('Ualá', 'https://www.ua.la/sumate', 'custom', 'uala')
)
INSERT INTO public.companies (
  name, careers_url, ats_type, ats_identifier, auto_apply_supported, active
)
SELECT
  s.name,
  s.careers_url,
  s.ats_type,
  s.ats_identifier,
  false,
  true
FROM seed s
WHERE NOT EXISTS (
  SELECT 1
  FROM public.companies c
  WHERE c.ats_type = s.ats_type
    AND lower(c.ats_identifier) = lower(s.ats_identifier)
);
