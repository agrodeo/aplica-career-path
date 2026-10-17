-- Worldwide Greenhouse expansion wave 13.
-- Additional global employers with public Greenhouse boards.

WITH seed(name, careers_url, ats_type, ats_identifier) AS (
  VALUES
    ('Flexport', 'https://job-boards.greenhouse.io/flexport', 'greenhouse', 'flexport'),
    ('Stripe', 'https://job-boards.greenhouse.io/stripe', 'greenhouse', 'stripe'),
    ('Datadog', 'https://job-boards.greenhouse.io/datadog', 'greenhouse', 'datadog'),
    ('Airbnb', 'https://job-boards.greenhouse.io/airbnb', 'greenhouse', 'airbnb'),
    ('Superhuman', 'https://job-boards.greenhouse.io/grammarly', 'greenhouse', 'grammarly')
)
INSERT INTO public.companies (
  name, careers_url, ats_type, ats_identifier, auto_apply_supported, active
)
SELECT s.name, s.careers_url, s.ats_type, s.ats_identifier, true, true
FROM seed s
WHERE NOT EXISTS (
  SELECT 1
  FROM public.companies c
  WHERE c.ats_type=s.ats_type
    AND lower(c.ats_identifier)=lower(s.ats_identifier)
);
