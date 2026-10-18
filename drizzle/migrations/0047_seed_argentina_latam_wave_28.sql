-- Argentina + LATAM expansion wave 28.
-- Argentina-heavy Greenhouse boards with current active roles.

WITH seed(name, careers_url, ats_type, ats_identifier) AS (
  VALUES
    ('Jampp', 'https://job-boards.greenhouse.io/jampp', 'greenhouse', 'jampp'),
    ('Particle41', 'https://job-boards.greenhouse.io/particle41llc', 'greenhouse', 'particle41llc')
)
INSERT INTO public.companies (
  name, careers_url, ats_type, ats_identifier, auto_apply_supported, active
)
SELECT s.name,s.careers_url,s.ats_type,s.ats_identifier,true,true
FROM seed s
WHERE NOT EXISTS (
  SELECT 1 FROM public.companies c
  WHERE c.ats_type=s.ats_type
    AND lower(c.ats_identifier)=lower(s.ats_identifier)
);