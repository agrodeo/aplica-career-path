-- Argentina + LATAM expansion wave 20.
-- Large Workday employers with current Argentina and LATAM hiring.

WITH seed(name, careers_url, ats_type, ats_identifier) AS (
  VALUES
    ('Johnson & Johnson', 'https://jj.wd5.myworkdayjobs.com/jj', 'workday', 'https://jj.wd5.myworkdayjobs.com/jj'),
    ('AES', 'https://aes.wd1.myworkdayjobs.com/AES_ASA', 'workday', 'https://aes.wd1.myworkdayjobs.com/AES_ASA'),
    ('ERM', 'https://erm.wd3.myworkdayjobs.com/en-US/ERM_Careers', 'workday', 'https://erm.wd3.myworkdayjobs.com/en-US/ERM_Careers'),
    ('APM Terminals / Maersk', 'https://maersk.wd3.myworkdayjobs.com/en-US/APMT_Careers', 'workday', 'https://maersk.wd3.myworkdayjobs.com/en-US/APMT_Careers'),
    ('Assurant', 'https://assurant.wd1.myworkdayjobs.com/en-US/assurant_careers', 'workday', 'https://assurant.wd1.myworkdayjobs.com/en-US/assurant_careers'),
    ('Parexel', 'https://parexel.wd1.myworkdayjobs.com/en-US/Parexel_External_Careers', 'workday', 'https://parexel.wd1.myworkdayjobs.com/en-US/Parexel_External_Careers'),
    ('Disney', 'https://disney.wd5.myworkdayjobs.com/disneycareer', 'workday', 'https://disney.wd5.myworkdayjobs.com/disneycareer'),
    ('Worldwide Clinical Trials', 'https://worldwide.wd1.myworkdayjobs.com/en-US/External', 'workday', 'https://worldwide.wd1.myworkdayjobs.com/en-US/External'),
    ('PwC', 'https://pwc.wd3.myworkdayjobs.com/global_campus_careers', 'workday', 'https://pwc.wd3.myworkdayjobs.com/global_campus_careers'),
    ('Hitachi', 'https://hitachi.wd1.myworkdayjobs.com/hitachi', 'workday', 'https://hitachi.wd1.myworkdayjobs.com/hitachi'),
    ('Edelman', 'https://djeholdings.wd5.myworkdayjobs.com/en-US/edelman-careers-E200', 'workday', 'https://djeholdings.wd5.myworkdayjobs.com/en-US/edelman-careers-E200')
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
