-- Worldwide Greenhouse expansion wave 14.
-- LATAM-heavy and globally distributed employers with live public boards.

WITH seed(name, careers_url, ats_type, ats_identifier) AS (
  VALUES
    ('Sezzle', 'https://job-boards.greenhouse.io/sezzle', 'greenhouse', 'sezzle'),
    ('Power Digital', 'https://job-boards.greenhouse.io/powerdigitalmarketing', 'greenhouse', 'powerdigitalmarketing'),
    ('Precision for Medicine', 'https://job-boards.greenhouse.io/pfm', 'greenhouse', 'pfm'),
    ('Telnyx', 'https://job-boards.greenhouse.io/telnyx54', 'greenhouse', 'telnyx54'),
    ('Globalli', 'https://job-boards.greenhouse.io/globalli', 'greenhouse', 'globalli'),
    ('Inflect', 'https://job-boards.greenhouse.io/inflect', 'greenhouse', 'inflect')
)
INSERT INTO public.companies (
  name, careers_url, ats_type, ats_identifier, auto_apply_supported, active
)
SELECT s.name, s.careers_url, s.ats_type, s.ats_identifier, true, true
FROM seed s
WHERE NOT EXISTS (
  SELECT 1 FROM public.companies c
  WHERE c.ats_type=s.ats_type
    AND lower(c.ats_identifier)=lower(s.ats_identifier)
);
