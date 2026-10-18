-- Argentina + LATAM expansion wave 30.
-- LATAM-native recruiting and remote-work boards.

WITH seed(name, careers_url, ats_type, ats_identifier) AS (
  VALUES
    ('Remote Talent LATAM', 'https://apply.workable.com/remote-talent-latam', 'workable', 'remote-talent-latam'),
    ('Valatam', 'https://apply.workable.com/valatam', 'workable', 'valatam'),
    ('Assistant Launch', 'https://apply.workable.com/assistant-launch', 'workable', 'assistant-launch'),
    ('Sauce', 'https://jobs.lever.co/Sauce', 'lever', 'Sauce'),
    ('Partyhat', 'https://jobs.ashbyhq.com/partyhat', 'ashby', 'partyhat')
)
INSERT INTO public.companies (
  name, careers_url, ats_type, ats_identifier, auto_apply_supported, active
)
SELECT s.name,s.careers_url,s.ats_type,s.ats_identifier,true,true
FROM seed s
WHERE NOT EXISTS (
  SELECT 1 FROM public.companies c
  WHERE c.ats_type=s.ats_type AND lower(c.ats_identifier)=lower(s.ats_identifier)
);