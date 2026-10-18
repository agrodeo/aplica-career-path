-- Argentina + LATAM expansion wave 17.
-- Adds Workable, Ashby and Lever boards explicitly hiring in Argentina and across LATAM.

WITH seed(name, careers_url, ats_type, ats_identifier) AS (
  VALUES
    ('FusionHit', 'https://apply.workable.com/fusionhitjobs/', 'workable', 'fusionhitjobs'),
    ('Azumo', 'https://apply.workable.com/azumo/', 'workable', 'azumo'),
    ('Flosum', 'https://apply.workable.com/flosum/', 'workable', 'flosum'),
    ('Paired', 'https://apply.workable.com/pairedrecruiting/', 'workable', 'pairedrecruiting'),
    ('Pavago', 'https://apply.workable.com/pavago/', 'workable', 'pavago'),
    ('Bolder Apps', 'https://apply.workable.com/bolderapps/', 'workable', 'bolderapps'),
    ('Libertex Group', 'https://apply.workable.com/libertexgroup/', 'workable', 'libertexgroup'),
    ('OKTO Payments', 'https://apply.workable.com/oktopayments/', 'workable', 'oktopayments'),
    ('Kirin', 'https://jobs.ashbyhq.com/kirin', 'ashby', 'kirin'),
    ('The Global Talent Co.', 'https://jobs.ashbyhq.com/the-global-talent-co', 'ashby', 'the-global-talent-co'),
    ('Simetrik', 'https://jobs.ashbyhq.com/simetrik', 'ashby', 'simetrik'),
    ('LatamCent', 'https://jobs.ashbyhq.com/latamcent', 'ashby', 'latamcent'),
    ('ReflexAI', 'https://jobs.ashbyhq.com/reflexai', 'ashby', 'reflexai'),
    ('doola', 'https://jobs.lever.co/doola', 'lever', 'doola')
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
