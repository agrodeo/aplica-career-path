-- LATAM expansion wave 15.
-- Prioritizes live Greenhouse boards with Argentina/LATAM hiring plus large SmartRecruiters employers
-- with substantial Brazil, Mexico, Colombia and broader regional inventory.

WITH seed(name, careers_url, ats_type, ats_identifier) AS (
  VALUES
    ('Santex', 'https://job-boards.greenhouse.io/santex', 'greenhouse', 'santex'),
    ('Nortal', 'https://job-boards.greenhouse.io/nortal', 'greenhouse', 'nortal'),
    ('Cobre', 'https://job-boards.greenhouse.io/cobre', 'greenhouse', 'cobre'),
    ('Lifted', 'https://job-boards.greenhouse.io/lifted', 'greenhouse', 'lifted'),
    ('Donorbox', 'https://job-boards.greenhouse.io/donorbox', 'greenhouse', 'donorbox'),
    ('Blip Global', 'https://job-boards.greenhouse.io/blip-global', 'greenhouse', 'blip-global'),
    ('Grupo Capqtus', 'https://job-boards.greenhouse.io/grupocapqtus', 'greenhouse', 'grupocapqtus'),
    ('Clara', 'https://job-boards.greenhouse.io/clara', 'greenhouse', 'clara'),
    ('Monster Energy LATAM', 'https://job-boards.greenhouse.io/monsterenergylatam', 'greenhouse', 'monsterenergylatam'),
    ('Hotmart', 'https://job-boards.greenhouse.io/hotmartcareersesp', 'greenhouse', 'hotmartcareersesp'),
    ('AlertMedia', 'https://job-boards.greenhouse.io/alertmedia', 'greenhouse', 'alertmedia'),
    ('Coinme', 'https://job-boards.greenhouse.io/coinme', 'greenhouse', 'coinme'),
    ('NABIS', 'https://job-boards.greenhouse.io/nabis', 'greenhouse', 'nabis'),
    ('WITHIN', 'https://job-boards.greenhouse.io/agencywithin', 'greenhouse', 'agencywithin'),
    ('Cloudbeds', 'https://job-boards.greenhouse.io/cloudbeds', 'greenhouse', 'cloudbeds'),
    ('Getnet', 'https://job-boards.greenhouse.io/getnet', 'greenhouse', 'getnet'),
    ('Wellhub', 'https://job-boards.greenhouse.io/gympass', 'greenhouse', 'gympass'),
    ('XP Inc Directed Applications', 'https://job-boards.greenhouse.io/candidaturasdirecionadasxpinc', 'greenhouse', 'candidaturasdirecionadasxpinc'),
    ('SoFi Tech Solutions LATAM', 'https://job-boards.greenhouse.io/sofitechsolutionslatam', 'greenhouse', 'sofitechsolutionslatam'),
    ('Admios', 'https://job-boards.greenhouse.io/admios', 'greenhouse', 'admios'),
    ('Fueled', 'https://job-boards.greenhouse.io/fueledcareers', 'greenhouse', 'fueledcareers'),
    ('VTEX', 'https://job-boards.greenhouse.io/vtex', 'greenhouse', 'vtex'),
    ('EBANX', 'https://job-boards.greenhouse.io/ebanx', 'greenhouse', 'ebanx'),
    ('Grupo QuintoAndar', 'https://job-boards.greenhouse.io/quintoandar', 'greenhouse', 'quintoandar'),
    ('Wildlife Studios', 'https://job-boards.greenhouse.io/wildlifestudios', 'greenhouse', 'wildlifestudios'),
    ('Accor', 'https://jobs.smartrecruiters.com/accor', 'smartrecruiters', 'accor'),
    ('QIMA', 'https://jobs.smartrecruiters.com/QIMA', 'smartrecruiters', 'QIMA'),
    ('Sika', 'https://jobs.smartrecruiters.com/SikaAG', 'smartrecruiters', 'SikaAG'),
    ('IBI Group / Arcadis', 'https://jobs.smartrecruiters.com/IBIGroup', 'smartrecruiters', 'IBIGroup'),
    ('Wise', 'https://jobs.smartrecruiters.com/Wise', 'smartrecruiters', 'Wise'),
    ('Signode', 'https://jobs.smartrecruiters.com/Signode', 'smartrecruiters', 'Signode'),
    ('Bosch Group', 'https://jobs.smartrecruiters.com/BoschGroup', 'smartrecruiters', 'BoschGroup'),
    ('NielsenIQ', 'https://jobs.smartrecruiters.com/NielsenIQ', 'smartrecruiters', 'NielsenIQ'),
    ('Turner & Townsend', 'https://jobs.smartrecruiters.com/TurnerTownsend', 'smartrecruiters', 'TurnerTownsend')
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
