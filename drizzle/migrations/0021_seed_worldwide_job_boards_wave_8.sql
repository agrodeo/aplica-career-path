WITH seed(name, identifier, careers_url) AS (
  VALUES
    ('Turner & Townsend','turnertownsend','https://jobs.smartrecruiters.com/turnertownsend'),
    ('JYSK','JYSK','https://jobs.smartrecruiters.com/JYSK'),
    ('SGS','SGS','https://jobs.smartrecruiters.com/SGS'),
    ('Eurofins','eurofins','https://jobs.smartrecruiters.com/eurofins'),
    ('Experian','Experian','https://jobs.smartrecruiters.com/Experian'),
    ('H&M Group','HMGroup','https://jobs.smartrecruiters.com/HMGroup')
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
