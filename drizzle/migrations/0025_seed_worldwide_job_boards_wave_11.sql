-- Worldwide ATS expansion wave 11.
-- Curated from currently live public ATS boards across US, LATAM, Europe and APAC.

WITH seed(name, careers_url, ats_type, ats_identifier) AS (
  VALUES
    ('Twilio', 'https://job-boards.greenhouse.io/twilio', 'greenhouse', 'twilio'),
    ('Discord', 'https://job-boards.greenhouse.io/discord', 'greenhouse', 'discord'),
    ('Discord International', 'https://job-boards.greenhouse.io/discordinternational', 'greenhouse', 'discordinternational'),
    ('Robinhood', 'https://job-boards.greenhouse.io/robinhood', 'greenhouse', 'robinhood'),
    ('Figma', 'https://job-boards.greenhouse.io/figma', 'greenhouse', 'figma'),
    ('Checkr', 'https://job-boards.greenhouse.io/checkr', 'greenhouse', 'checkr'),
    ('Coinbase', 'https://job-boards.greenhouse.io/coinbase', 'greenhouse', 'coinbase'),
    ('Captivation Software', 'https://job-boards.greenhouse.io/captivation', 'greenhouse', 'captivation'),
    ('Trace3', 'https://job-boards.greenhouse.io/trace3', 'greenhouse', 'trace3'),
    ('Caylent', 'https://job-boards.greenhouse.io/caylent', 'greenhouse', 'caylent'),
    ('NTT DATA Europe & LATAM', 'https://job-boards.greenhouse.io/nttdatausa', 'greenhouse', 'nttdatausa'),
    ('Smartsheet', 'https://job-boards.greenhouse.io/smartsheet', 'greenhouse', 'smartsheet'),
    ('Nimble Gravity', 'https://job-boards.greenhouse.io/nimblegravity', 'greenhouse', 'nimblegravity'),
    ('ilia', 'https://job-boards.greenhouse.io/ilia', 'greenhouse', 'ilia'),
    ('Lantern', 'https://job-boards.greenhouse.io/lanternstudiosinc', 'greenhouse', 'lanternstudiosinc'),
    ('Freenow by Lyft', 'https://job-boards.greenhouse.io/freenow', 'greenhouse', 'freenow'),
    ('Syngenta Group', 'https://jobs.smartrecruiters.com/SyngentaGroup', 'smartrecruiters', 'SyngentaGroup'),
    ('Talan', 'https://jobs.smartrecruiters.com/Talan', 'smartrecruiters', 'Talan'),
    ('Sutherland', 'https://jobs.smartrecruiters.com/Sutherland', 'smartrecruiters', 'Sutherland'),
    ('Continental', 'https://jobs.smartrecruiters.com/Continental', 'smartrecruiters', 'Continental'),
    ('Continental ContiTech', 'https://jobs.smartrecruiters.com/ContinentalGroupSectorContiTech', 'smartrecruiters', 'ContinentalGroupSectorContiTech')
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
