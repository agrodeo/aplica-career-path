-- Argentina + LATAM expansion wave 24.
-- Ashby boards with current remote Argentina / LATAM hiring.

WITH seed(name, careers_url, ats_type, ats_identifier) AS (
  VALUES
    ('Bullpen Talent', 'https://jobs.ashbyhq.com/bullpen-talent', 'ashby', 'bullpen-talent'),
    ('Whippy', 'https://jobs.ashbyhq.com/whippy', 'ashby', 'whippy'),
    ('Skydropx', 'https://jobs.ashbyhq.com/Skydropx', 'ashby', 'Skydropx'),
    ('Siena AI', 'https://jobs.ashbyhq.com/siena', 'ashby', 'siena'),
    ('Mural', 'https://jobs.ashbyhq.com/mural', 'ashby', 'mural'),
    ('HomeVision', 'https://jobs.ashbyhq.com/homevision', 'ashby', 'homevision'),
    ('ElevenLabs', 'https://jobs.ashbyhq.com/elevenlabs', 'ashby', 'elevenlabs'),
    ('Breakmark', 'https://jobs.ashbyhq.com/breakmark', 'ashby', 'breakmark'),
    ('Pyyne', 'https://jobs.ashbyhq.com/Pyyne', 'ashby', 'Pyyne'),
    ('Exfold', 'https://jobs.ashbyhq.com/exfold', 'ashby', 'exfold')
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