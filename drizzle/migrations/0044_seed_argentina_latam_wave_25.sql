-- Argentina + LATAM expansion wave 25.
-- Live ATS boards verified with current Argentina / LATAM openings.

WITH seed(name, careers_url, ats_type, ats_identifier) AS (
  VALUES
    ('Innovid', 'https://job-boards.greenhouse.io/innovid', 'greenhouse', 'innovid'),
    ('Span', 'https://jobs.ashbyhq.com/span.app', 'ashby', 'span.app'),
    ('Chainlink Labs', 'https://jobs.ashbyhq.com/chainlink-labs', 'ashby', 'chainlink-labs'),
    ('Ole Life', 'https://jobs.lever.co/ole-management', 'lever', 'ole-management'),
    ('Optery', 'https://jobs.ashbyhq.com/optery', 'ashby', 'optery'),
    ('Futureproofing', 'https://jobs.ashbyhq.com/futureproofing', 'ashby', 'futureproofing'),
    ('Uproot Clean', 'https://jobs.ashbyhq.com/uprootclean', 'ashby', 'uprootclean'),
    ('Outpost red', 'https://jobs.ashbyhq.com/outpost-red', 'ashby', 'outpost-red')
)
INSERT INTO public.companies (
  name, careers_url, ats_type, ats_identifier, auto_apply_supported, active
)
SELECT s.name,s.careers_url,s.ats_type,s.ats_identifier,true,true
FROM seed s
WHERE NOT EXISTS (
  SELECT 1 FROM public.companies c
  WHERE c.ats_type=s.ats_type
    AND lower(c.ats_identifier)=lower(s.ats_identifier)
);