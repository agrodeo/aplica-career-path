WITH seed(name, ats_type, identifier, careers_url) AS (
  VALUES
    ('Thomson Reuters','workday','https://thomsonreuters.wd5.myworkdayjobs.com/en-US/External_Career_Site','https://thomsonreuters.wd5.myworkdayjobs.com/en-US/External_Career_Site'),
    ('NielsenIQ','smartrecruiters','NielsenIQ','https://jobs.smartrecruiters.com/NielsenIQ'),
    ('Dentsu Aegis Network','smartrecruiters','DentsuAegisNetwork3','https://jobs.smartrecruiters.com/DentsuAegisNetwork3'),
    ('Evolution','smartrecruiters','Evolution','https://jobs.smartrecruiters.com/Evolution'),
    ('Sia','smartrecruiters','Sia','https://jobs.smartrecruiters.com/Sia'),
    ('Devoteam','smartrecruiters','Devoteam','https://jobs.smartrecruiters.com/Devoteam'),
    ('TOMRA','smartrecruiters','Tomra','https://jobs.smartrecruiters.com/Tomra'),
    ('Lovable','ashby','lovable','https://jobs.ashbyhq.com/lovable'),
    ('Loopio','ashby','loopio','https://jobs.ashbyhq.com/loopio'),
    ('Wynd Labs','ashby','wynd-labs','https://jobs.ashbyhq.com/wynd-labs'),
    ('Arago','ashby','arago','https://jobs.ashbyhq.com/arago'),
    ('Airbound','ashby','airbound','https://jobs.ashbyhq.com/airbound'),
    ('Coworker.ai','ashby','coworker','https://jobs.ashbyhq.com/coworker'),
    ('Nava Benefits','ashby','nava-benefits','https://jobs.ashbyhq.com/nava-benefits')
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
