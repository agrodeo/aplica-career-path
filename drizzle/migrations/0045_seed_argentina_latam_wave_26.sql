-- Argentina + LATAM expansion wave 26.
-- Adds live boards with explicit Buenos Aires / Argentina / LATAM openings.

WITH seed(name, careers_url, ats_type, ats_identifier) AS (
  VALUES
    ('Aleph', 'https://jobs.lever.co/aleph', 'lever', 'aleph'),
    ('Hauler Hero', 'https://jobs.ashbyhq.com/hauler-hero', 'ashby', 'hauler-hero'),
    ('Voldex Games', 'https://jobs.ashbyhq.com/Voldex', 'ashby', 'Voldex'),
    ('Willow Health', 'https://jobs.ashbyhq.com/willow-health', 'ashby', 'willow-health')
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