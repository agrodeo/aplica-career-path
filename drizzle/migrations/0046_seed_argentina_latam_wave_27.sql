-- Argentina + LATAM expansion wave 27.
-- Remote-friendly boards with current LATAM / Argentina roles.

WITH seed(name, careers_url, ats_type, ats_identifier) AS (
  VALUES
    ('Amplemarket', 'https://job-boards.greenhouse.io/amplemarket', 'greenhouse', 'amplemarket'),
    ('Alpaca', 'https://job-boards.greenhouse.io/alpaca', 'greenhouse', 'alpaca'),
    ('Pipe17', 'https://job-boards.greenhouse.io/pipe17', 'greenhouse', 'pipe17'),
    ('Thanx', 'https://job-boards.greenhouse.io/thanx', 'greenhouse', 'thanx'),
    ('Scale Army Careers', 'https://jobs.ashbyhq.com/Scale%20Army%20Careers', 'ashby', 'Scale Army Careers')
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