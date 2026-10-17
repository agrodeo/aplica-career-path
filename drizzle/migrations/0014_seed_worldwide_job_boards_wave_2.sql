WITH seed(name, ats_type, identifier, careers_url) AS (
  VALUES
    ('Enveritas','greenhouse','enveritas','https://job-boards.greenhouse.io/enveritas'),
    ('WeightWatchers','greenhouse','ww','https://job-boards.greenhouse.io/ww'),
    ('Shields Health Solutions','greenhouse','shieldshealthsolutions','https://job-boards.greenhouse.io/shieldshealthsolutions'),
    ('GOAL Honduras','greenhouse','goalhonduras','https://job-boards.greenhouse.io/goalhonduras'),
    ('Greenhouse','greenhouse','greenhouse','https://job-boards.greenhouse.io/greenhouse'),
    ('Accelerate People','greenhouse','acceleratepeople','https://job-boards.greenhouse.io/acceleratepeople'),
    ('TechGrove by Banyan Software','greenhouse','techgrovebybanyansoftware','https://job-boards.greenhouse.io/techgrovebybanyansoftware'),
    ('SuperApp','greenhouse','superapp','https://job-boards.greenhouse.io/superapp'),
    ('Redwood Software','greenhouse','redwoodsoftware','https://job-boards.greenhouse.io/redwoodsoftware'),
    ('Conga','greenhouse','conga','https://job-boards.greenhouse.io/conga'),
    ('G-P','greenhouse','globalizationpartners','https://job-boards.greenhouse.io/globalizationpartners'),
    ('AlphaSense','greenhouse','alphasense','https://job-boards.greenhouse.io/alphasense'),
    ('Deliveroo','greenhouse','deliveroo','https://job-boards.greenhouse.io/deliveroo'),
    ('WOO X','greenhouse','woox','https://job-boards.greenhouse.io/woox'),
    ('WOOFi','greenhouse','woofi1','https://job-boards.greenhouse.io/woofi1'),
    ('Agent','ashby','agent','https://jobs.ashbyhq.com/agent'),
    ('Ashby','ashby','ashby','https://jobs.ashbyhq.com/ashby'),
    ('Tsenta','ashby','tsenta','https://jobs.ashbyhq.com/tsenta'),
    ('Focus','ashby','focus','https://jobs.ashbyhq.com/focus'),
    ('Omniscient','ashby','omniscient','https://jobs.ashbyhq.com/omniscient'),
    ('RemotePass','workable','remotepass','https://apply.workable.com/remotepass/'),
    ('We Clone You','workable','wecloneyou','https://apply.workable.com/wecloneyou/'),
    ('Packt','workable','packtpublishing','https://apply.workable.com/packtpublishing/'),
    ('Ally','smartrecruiters','Ally1','https://jobs.smartrecruiters.com/Ally1'),
    ('LinkedIn','smartrecruiters','LinkedIn3','https://jobs.smartrecruiters.com/LinkedIn3'),
    ('EVB','smartrecruiters','EVB','https://jobs.smartrecruiters.com/EVB'),
    ('Pirsonal','smartrecruiters','Pirsonal','https://jobs.smartrecruiters.com/Pirsonal'),
    ('Strategy','smartrecruiters','MicroStrategy1','https://jobs.smartrecruiters.com/MicroStrategy1'),
    ('NEC Software Solutions','smartrecruiters','NECSWS','https://jobs.smartrecruiters.com/NECSWS'),
    ('Renesas Electronics','smartrecruiters','renesaselectronics','https://jobs.smartrecruiters.com/renesaselectronics'),
    ('Miratech','smartrecruiters','miratech1','https://jobs.smartrecruiters.com/miratech1'),
    ('ServiceNow','smartrecruiters','ServiceNow','https://jobs.smartrecruiters.com/ServiceNow'),
    ('Hitachi Solutions','smartrecruiters','HitachiSolutions','https://jobs.smartrecruiters.com/HitachiSolutions'),
    ('QAD','smartrecruiters','QADInc','https://jobs.smartrecruiters.com/QADInc'),
    ('CD PROJEKT RED','smartrecruiters','CDPROJEKTRED','https://jobs.smartrecruiters.com/CDPROJEKTRED'),
    ('Mirantis','smartrecruiters','Mirantis','https://jobs.smartrecruiters.com/Mirantis'),
    ('Dalstrong','smartrecruiters','dalstrong','https://jobs.smartrecruiters.com/dalstrong'),
    ('Wing Assistant','lever','getwingapp','https://jobs.lever.co/getwingapp'),
    ('Assist World','lever','assist-world','https://jobs.lever.co/assist-world')
)
INSERT INTO public.companies (
  name, careers_url, ats_type, ats_identifier, auto_apply_supported, active
)
SELECT s.name, s.careers_url, s.ats_type, s.identifier, true, true
FROM seed s
WHERE NOT EXISTS (
  SELECT 1
  FROM public.companies c
  WHERE c.ats_type = s.ats_type
    AND c.ats_identifier = s.identifier
);
