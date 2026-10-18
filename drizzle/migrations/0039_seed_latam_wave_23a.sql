-- LATAM expansion wave 15.
-- Prioritizes live ATS boards with Argentina / Brazil / Mexico / Colombia / LATAM coverage.

WITH seed(name, careers_url, ats_type, ats_identifier) AS (
  VALUES
    ('TRM Labs', 'https://job-boards.greenhouse.io/trmlabs', 'greenhouse', 'trmlabs'),
    ('Nearsure', 'https://job-boards.greenhouse.io/nearsure', 'greenhouse', 'nearsure'),
    ('Baubap', 'https://job-boards.greenhouse.io/baubap', 'greenhouse', 'baubap'),
    ('AspenView Technology Partners', 'https://job-boards.greenhouse.io/aspenviewtech', 'greenhouse', 'aspenviewtech'),
    ('Varicent', 'https://job-boards.greenhouse.io/varicent', 'greenhouse', 'varicent'),
    ('Coface', 'https://jobs.smartrecruiters.com/Coface', 'smartrecruiters', 'Coface'),
    ('Mattel', 'https://jobs.smartrecruiters.com/MattelInc', 'smartrecruiters', 'MattelInc'),
    ('Lesaffre', 'https://jobs.smartrecruiters.com/Lesaffre', 'smartrecruiters', 'Lesaffre'),
    ('Experian', 'https://jobs.smartrecruiters.com/Experian', 'smartrecruiters', 'Experian'),
    ('Avery Dennison', 'https://jobs.smartrecruiters.com/AveryDennison', 'smartrecruiters', 'AveryDennison'),
    ('Atmosera', 'https://jobs.lever.co/atmosera', 'lever', 'atmosera'),
    ('BriteCore', 'https://jobs.lever.co/britecore', 'lever', 'britecore')
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