-- LATAM expansion wave 21.
-- Large Workday employers with current Brazil, Mexico, Colombia, Chile, Peru and Argentina hiring.

WITH seed(name, careers_url, ats_type, ats_identifier) AS (
  VALUES
    ('Veralto', 'https://veralto.wd1.myworkdayjobs.com/en-US/VeraltoCorporateJobs', 'workday', 'https://veralto.wd1.myworkdayjobs.com/en-US/VeraltoCorporateJobs'),
    ('PayPal', 'https://paypal.wd1.myworkdayjobs.com/en-US/jobs', 'workday', 'https://paypal.wd1.myworkdayjobs.com/en-US/jobs'),
    ('IQVIA', 'https://iqvia.wd1.myworkdayjobs.com/en-US/IQVIA', 'workday', 'https://iqvia.wd1.myworkdayjobs.com/en-US/IQVIA'),
    ('Rockwell Automation', 'https://rockwellautomation.wd1.myworkdayjobs.com/es/External_Rockwell_Automation', 'workday', 'https://rockwellautomation.wd1.myworkdayjobs.com/es/External_Rockwell_Automation'),
    ('NTT DATA', 'https://nttlimited.wd3.myworkdayjobs.com/en-US/NTT_Careers', 'workday', 'https://nttlimited.wd3.myworkdayjobs.com/en-US/NTT_Careers'),
    ('Visa', 'https://visa.wd5.myworkdayjobs.com/en-US/Visa', 'workday', 'https://visa.wd5.myworkdayjobs.com/en-US/Visa'),
    ('TD SYNNEX', 'https://synnex.wd5.myworkdayjobs.com/en-US/tdsynnexcareers', 'workday', 'https://synnex.wd5.myworkdayjobs.com/en-US/tdsynnexcareers'),
    ('Motorola Solutions', 'https://motorolasolutions.wd5.myworkdayjobs.com/en-US/Careers', 'workday', 'https://motorolasolutions.wd5.myworkdayjobs.com/en-US/Careers'),
    ('Infobip', 'https://infobip.wd3.myworkdayjobs.com/en-US/InfobipCareers', 'workday', 'https://infobip.wd3.myworkdayjobs.com/en-US/InfobipCareers'),
    ('Medtronic', 'https://medtronic.wd1.myworkdayjobs.com/es/MedtronicCareers', 'workday', 'https://medtronic.wd1.myworkdayjobs.com/es/MedtronicCareers'),
    ('Diageo', 'https://diageo.wd3.myworkdayjobs.com/en-US/Diageo_Careers', 'workday', 'https://diageo.wd3.myworkdayjobs.com/en-US/Diageo_Careers')
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
