WITH seed(name, identifier, careers_url) AS (
  VALUES
    ('Mastercard','https://mastercard.wd1.myworkdayjobs.com/corporatecareers','https://mastercard.wd1.myworkdayjobs.com/corporatecareers'),
    ('Salesforce','https://salesforce.wd12.myworkdayjobs.com/en-US/External_Career_Site','https://salesforce.wd12.myworkdayjobs.com/en-US/External_Career_Site'),
    ('Pfizer','https://pfizer.wd1.myworkdayjobs.com/pfizercareers','https://pfizer.wd1.myworkdayjobs.com/pfizercareers'),
    ('Adobe','https://adobe.wd5.myworkdayjobs.com/en-US/external_experienced','https://adobe.wd5.myworkdayjobs.com/en-US/external_experienced'),
    ('Accenture','https://accenture.wd103.myworkdayjobs.com/en-US/AccentureCareers','https://accenture.wd103.myworkdayjobs.com/en-US/AccentureCareers')
)
INSERT INTO public.companies (
  name, careers_url, ats_type, ats_identifier, auto_apply_supported, active
)
SELECT s.name, s.careers_url, 'workday', s.identifier, true, true
FROM seed s
WHERE NOT EXISTS (
  SELECT 1 FROM public.companies c
  WHERE c.ats_type='workday' AND c.ats_identifier=s.identifier
);
