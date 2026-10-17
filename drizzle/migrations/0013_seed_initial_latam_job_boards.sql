WITH seed(name, identifier, careers_url) AS (
  VALUES
    ('Binance','binance','https://jobs.lever.co/binance'),
    ('Talentus Global','TalentusGlobal','https://jobs.lever.co/TalentusGlobal'),
    ('Listo','listo','https://jobs.lever.co/listo'),
    ('Superside','superside','https://jobs.lever.co/superside'),
    ('Loadsmart','loadsmart','https://jobs.lever.co/loadsmart'),
    ('IDT','idt','https://jobs.lever.co/idt'),
    ('Terrific','terrific-innovation','https://jobs.lever.co/terrific-innovation'),
    ('Z1 Tech','z1tech','https://jobs.lever.co/z1tech'),
    ('Jobgether','jobgether','https://jobs.lever.co/jobgether'),
    ('Massive Rocket','massive-rocket','https://jobs.lever.co/massive-rocket')
)
INSERT INTO public.companies (
  name, careers_url, ats_type, ats_identifier, auto_apply_supported, active
)
SELECT s.name, s.careers_url, 'lever', s.identifier, true, true
FROM seed s
WHERE NOT EXISTS (
  SELECT 1
  FROM public.companies c
  WHERE c.ats_type = 'lever' AND c.ats_identifier = s.identifier
);
