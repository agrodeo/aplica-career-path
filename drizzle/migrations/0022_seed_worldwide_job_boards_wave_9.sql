WITH seed(name, identifier, careers_url) AS (
  VALUES
    ('Ramboll','Ramboll3','https://jobs.smartrecruiters.com/Ramboll3'),
    ('Assystem','ASSYSTEM','https://jobs.smartrecruiters.com/ASSYSTEM'),
    ('Veolia','VeoliaEnvironnementSA','https://jobs.smartrecruiters.com/VeoliaEnvironnementSA'),
    ('Egis','egisgroup','https://jobs.smartrecruiters.com/egisgroup')
)
INSERT INTO public.companies (
  name, careers_url, ats_type, ats_identifier, auto_apply_supported, active
)
SELECT s.name, s.careers_url, 'smartrecruiters', s.identifier, true, true
FROM seed s
WHERE NOT EXISTS (
  SELECT 1 FROM public.companies c
  WHERE c.ats_type='smartrecruiters'
    AND lower(c.ats_identifier)=lower(s.identifier)
);
