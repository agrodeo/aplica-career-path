-- Argentina + LATAM expansion wave 16.
-- Adds verified public ATS boards with strong hiring presence across Argentina and Latin America.

WITH seed(name, careers_url, ats_type, ats_identifier) AS (
  VALUES
    ('dLocal', 'https://jobs.lever.co/dlocal', 'lever', 'dlocal'),
    ('Kavak', 'https://jobs.lever.co/kavak', 'lever', 'kavak'),
    ('Despegar', 'https://jobs.lever.co/despegar', 'lever', 'despegar'),
    ('Caliza', 'https://jobs.lever.co/caliza-financial-technologies', 'lever', 'caliza-financial-technologies'),
    ('Unlimit', 'https://jobs.lever.co/unlimit', 'lever', 'unlimit'),
    ('Yuno', 'https://jobs.lever.co/yuno', 'lever', 'yuno'),
    ('Mutt Data', 'https://jobs.lever.co/muttdata', 'lever', 'muttdata'),
    ('RYZ Labs', 'https://jobs.lever.co/RyzLabs', 'lever', 'RyzLabs'),
    ('ASAPP', 'https://jobs.lever.co/asapp-2', 'lever', 'asapp-2'),
    ('Bluelight Consulting', 'https://jobs.lever.co/bluelightconsulting', 'lever', 'bluelightconsulting'),
    ('Coderio', 'https://jobs.lever.co/coderio', 'lever', 'coderio'),
    ('Jeeves', 'https://jobs.lever.co/tryjeeves', 'lever', 'tryjeeves'),
    ('Allata', 'https://jobs.lever.co/Allata', 'lever', 'Allata'),
    ('OLIVER Agency Argentina', 'https://job-boards.greenhouse.io/oliverargentina', 'greenhouse', 'oliverargentina'),
    ('Factored', 'https://job-boards.greenhouse.io/factored', 'greenhouse', 'factored'),
    ('Verifone', 'https://job-boards.greenhouse.io/verifone', 'greenhouse', 'verifone'),
    ('Nubank', 'https://job-boards.greenhouse.io/nubank', 'greenhouse', 'nubank')
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
