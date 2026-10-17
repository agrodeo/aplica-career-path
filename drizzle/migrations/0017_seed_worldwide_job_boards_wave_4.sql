WITH seed(name, ats_type, identifier, careers_url) AS (
  VALUES
    ('GitLab','greenhouse','gitlab','https://job-boards.greenhouse.io/gitlab'),
    ('GitLab Prospects','greenhouse','gitlabcrm','https://job-boards.greenhouse.io/gitlabcrm'),
    ('Bosch Group','smartrecruiters','BoschGroup','https://jobs.smartrecruiters.com/BoschGroup'),
    ('Avery Dennison','smartrecruiters','averydennison','https://jobs.smartrecruiters.com/averydennison'),
    ('Western Digital','smartrecruiters','westerndigital','https://jobs.smartrecruiters.com/westerndigital'),
    ('Ubisoft','smartrecruiters','ubisoft2','https://jobs.smartrecruiters.com/ubisoft2')
)
INSERT INTO public.companies (
  name, careers_url, ats_type, ats_identifier, auto_apply_supported, active
)
SELECT s.name, s.careers_url, s.ats_type, s.identifier, true, true
FROM seed s
WHERE NOT EXISTS (
  SELECT 1 FROM public.companies c
  WHERE c.ats_type=s.ats_type
    AND lower(c.ats_identifier)=lower(s.identifier)
);
