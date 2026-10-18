DO $area_expansion$
BEGIN
-- Expand beyond technology with live-verified employer boards.
-- Keep duplicate company records for history, reparent jobs before hiding them,
-- and prevent concurrent inventory lanes from creating more active copies.
LOCK TABLE public.companies IN SHARE ROW EXCLUSIVE MODE;

WITH ranked AS (
  SELECT id, first_value(id) OVER (
    PARTITION BY ats_type, ats_identifier ORDER BY created_at, id
  ) AS canonical_id
  FROM public.companies
  WHERE active AND ats_identifier IS NOT NULL
)
UPDATE public.jobs j SET company_id = r.canonical_id
FROM ranked r WHERE j.company_id = r.id AND r.id <> r.canonical_id;

WITH ranked AS (
  SELECT id, row_number() OVER (
    PARTITION BY ats_type, ats_identifier ORDER BY created_at, id
  ) AS position
  FROM public.companies
  WHERE active AND ats_identifier IS NOT NULL
)
UPDATE public.companies c SET active = false
FROM ranked r WHERE c.id = r.id AND r.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS companies_active_ats_board_uidx
  ON public.companies (ats_type, ats_identifier)
  WHERE active AND ats_identifier IS NOT NULL;

WITH seed(name, careers_url, ats_type, ats_identifier) AS (
  VALUES
    ('BESIX', 'https://jobs.smartrecruiters.com/BESIX', 'smartrecruiters', 'BESIX'),
    ('Chandos', 'https://jobs.smartrecruiters.com/Chandos', 'smartrecruiters', 'Chandos'),
    ('Education Development Center', 'https://jobs.smartrecruiters.com/EducationDevelopmentCenter', 'smartrecruiters', 'EducationDevelopmentCenter'),
    ('KIPP', 'https://jobs.smartrecruiters.com/KIPP', 'smartrecruiters', 'KIPP'),
    ('Uncommon Schools', 'https://jobs.smartrecruiters.com/UncommonSchools', 'smartrecruiters', 'UncommonSchools'),
    ('Vattenfall', 'https://jobs.smartrecruiters.com/Vattenfall', 'smartrecruiters', 'Vattenfall'),
    ('AECOM', 'https://jobs.smartrecruiters.com/AECOM2', 'smartrecruiters', 'AECOM2'),
    ('Ghobash Group', 'https://jobs.smartrecruiters.com/GhobashGroup', 'smartrecruiters', 'GhobashGroup'),
    ('Rentokil Initial', 'https://jobs.smartrecruiters.com/RentokilInitial1', 'smartrecruiters', 'RentokilInitial1'),
    ('Sodexo', 'https://jobs.smartrecruiters.com/Sodexo', 'smartrecruiters', 'Sodexo'),
    ('Domino''s', 'https://jobs.smartrecruiters.com/Dominos', 'smartrecruiters', 'Dominos'),
    ('Eataly North America', 'https://jobs.smartrecruiters.com/Eataly', 'smartrecruiters', 'Eataly'),
    ('Dungarvin', 'https://jobs.smartrecruiters.com/Dungarvin', 'smartrecruiters', 'Dungarvin'),
    ('Kittitas Valley Healthcare', 'https://jobs.smartrecruiters.com/KittitasValleyHealthcare', 'smartrecruiters', 'KittitasValleyHealthcare'),
    ('La Rabida Children''s Hospital', 'https://jobs.smartrecruiters.com/LaRabidaChildrensHospital', 'smartrecruiters', 'LaRabidaChildrensHospital'),
    ('Northwestern Memorial Healthcare', 'https://jobs.smartrecruiters.com/NorthwesternMedicine', 'smartrecruiters', 'NorthwesternMedicine'),
    ('Ramsay Health Care', 'https://jobs.smartrecruiters.com/RamsayHealthCare1', 'smartrecruiters', 'RamsayHealthCare1'),
    ('University Health Network', 'https://jobs.smartrecruiters.com/UniversityHealthNetwork', 'smartrecruiters', 'UniversityHealthNetwork'),
    ('Accor Hotels', 'https://jobs.smartrecruiters.com/AccorHotel', 'smartrecruiters', 'AccorHotel'),
    ('Minor International', 'https://jobs.smartrecruiters.com/MinorInternational', 'smartrecruiters', 'MinorInternational'),
    ('Konecranes', 'https://jobs.smartrecruiters.com/Konecranes', 'smartrecruiters', 'Konecranes'),
    ('Rotork', 'https://jobs.smartrecruiters.com/Rotork', 'smartrecruiters', 'Rotork'),
    ('Culina Group', 'https://jobs.smartrecruiters.com/CulinaGroup1', 'smartrecruiters', 'CulinaGroup1'),
    ('Expeditors', 'https://jobs.smartrecruiters.com/Expeditors', 'smartrecruiters', 'Expeditors'),
    ('Anglo American / De Beers Group', 'https://jobs.smartrecruiters.com/AngloAmericanDeBeersGroup', 'smartrecruiters', 'AngloAmericanDeBeersGroup'),
    ('AbbVie', 'https://jobs.smartrecruiters.com/AbbVie', 'smartrecruiters', 'AbbVie'),
    ('Colliers', 'https://jobs.smartrecruiters.com/Colliers', 'smartrecruiters', 'Colliers'),
    ('Farm Boy Inc.', 'https://jobs.smartrecruiters.com/FarmBoyInc', 'smartrecruiters', 'FarmBoyInc'),
    ('Frasers Group', 'https://jobs.smartrecruiters.com/FrasersGroup', 'smartrecruiters', 'FrasersGroup'),
    ('Inter IKEA Group', 'https://jobs.smartrecruiters.com/InterIKEAGroup', 'smartrecruiters', 'InterIKEAGroup'),
    ('Red Wing Shoe Company', 'https://jobs.smartrecruiters.com/RedWingShoeCompany', 'smartrecruiters', 'RedWingShoeCompany'),
    ('Rituals', 'https://jobs.smartrecruiters.com/Rituals1', 'smartrecruiters', 'Rituals1'),
    ('Walmart Inc.', 'https://jobs.smartrecruiters.com/WalmartInc', 'smartrecruiters', 'WalmartInc'),
    ('Securitas', 'https://jobs.smartrecruiters.com/Securitas', 'smartrecruiters', 'Securitas'),
    ('SIXT', 'https://jobs.smartrecruiters.com/SIXT', 'smartrecruiters', 'SIXT')
)
INSERT INTO public.companies (
  name, careers_url, ats_type, ats_identifier, auto_apply_supported, active
)
SELECT s.name, s.careers_url, s.ats_type, s.ats_identifier, true, true FROM seed s
WHERE NOT EXISTS (
  SELECT 1 FROM public.companies c
  WHERE c.active AND c.ats_type = s.ats_type
    AND lower(c.ats_identifier) = lower(s.ats_identifier)
)
ON CONFLICT (ats_type, ats_identifier)
  WHERE active AND ats_identifier IS NOT NULL
DO NOTHING;

END;
$area_expansion$;
