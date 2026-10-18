-- Argentina + LATAM expansion wave 18.
-- Large SmartRecruiters employers with active Argentina/LATAM roles.

WITH seed(name, careers_url, ats_type, ats_identifier) AS (
  VALUES
    ('PedidosYa / Delivery Hero', 'https://jobs.smartrecruiters.com/DeliveryHero', 'smartrecruiters', 'DeliveryHero'),
    ('Canva', 'https://jobs.smartrecruiters.com/canva', 'smartrecruiters', 'canva'),
    ('Check Point Software Technologies', 'https://jobs.smartrecruiters.com/CheckPointSoftwareTechnologies2', 'smartrecruiters', 'CheckPointSoftwareTechnologies2'),
    ('Cielo', 'https://jobs.smartrecruiters.com/cielo2', 'smartrecruiters', 'cielo2'),
    ('Inetum', 'https://jobs.smartrecruiters.com/Inetum2', 'smartrecruiters', 'Inetum2'),
    ('CONFISA International Group', 'https://jobs.smartrecruiters.com/CONFISAINTERNATIONALGROUP', 'smartrecruiters', 'CONFISAINTERNATIONALGROUP'),
    ('Docplanner', 'https://jobs.smartrecruiters.com/Docplanner', 'smartrecruiters', 'Docplanner')
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
