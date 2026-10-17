INSERT INTO public.companies (
  name, careers_url, ats_type, ats_identifier, auto_apply_supported, active
)
SELECT
  'Sopra Steria',
  'https://jobs.smartrecruiters.com/SopraSteria1',
  'smartrecruiters',
  'SopraSteria1',
  true,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.companies
  WHERE ats_type='smartrecruiters'
    AND lower(ats_identifier)=lower('SopraSteria1')
);
