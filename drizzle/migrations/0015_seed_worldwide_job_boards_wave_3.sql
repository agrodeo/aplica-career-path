WITH seed(name, identifier, careers_url) AS (
  VALUES
    ('Scale AI','scaleai','https://job-boards.greenhouse.io/scaleai'),
    ('Affirm','affirm','https://job-boards.greenhouse.io/affirm'),
    ('Vercel','vercel','https://job-boards.greenhouse.io/vercel'),
    ('Reddit','reddit','https://job-boards.greenhouse.io/reddit'),
    ('Figure','figureai','https://job-boards.greenhouse.io/figureai'),
    ('FIGS','figs15','https://job-boards.greenhouse.io/figs15'),
    ('PLS','plscareers','https://job-boards.greenhouse.io/plscareers'),
    ('Fin / Intercom','intercom','https://job-boards.greenhouse.io/intercom'),
    ('GoFundMe','gofundme','https://job-boards.greenhouse.io/gofundme'),
    ('Dataiku','dataiku','https://job-boards.greenhouse.io/dataiku'),
    ('mthree','mthreerecruitingportal','https://job-boards.greenhouse.io/mthreerecruitingportal'),
    ('MEMX','memx','https://job-boards.greenhouse.io/memx'),
    ('Boulevard','boulevard','https://job-boards.greenhouse.io/boulevard'),
    ('LaunchDarkly','LaunchDarkly','https://job-boards.greenhouse.io/LaunchDarkly'),
    ('InvGate','invgate','https://job-boards.greenhouse.io/invgate'),
    ('Livefront','livefront','https://job-boards.greenhouse.io/livefront'),
    ('Interview Engineering','interviewengineering','https://job-boards.greenhouse.io/interviewengineering'),
    ('Arionkoder','arionkoder','https://job-boards.greenhouse.io/arionkoder'),
    ('Box','boxinc','https://job-boards.greenhouse.io/boxinc'),
    ('Future','future','https://job-boards.greenhouse.io/future'),
    ('Overstory','overstory','https://job-boards.greenhouse.io/overstory'),
    ('Super Payments','superpayments','https://job-boards.greenhouse.io/superpayments'),
    ('MAP','map','https://job-boards.greenhouse.io/map'),
    ('Known','known','https://job-boards.greenhouse.io/known'),
    ('Understood','understood','https://job-boards.greenhouse.io/understood'),
    ('Datavations','datavations','https://job-boards.greenhouse.io/datavations'),
    ('Warp','warp','https://job-boards.greenhouse.io/warp'),
    ('System','system','https://job-boards.greenhouse.io/system')
)
INSERT INTO public.companies (
  name, careers_url, ats_type, ats_identifier, auto_apply_supported, active
)
SELECT s.name, s.careers_url, 'greenhouse', s.identifier, true, true
FROM seed s
WHERE NOT EXISTS (
  SELECT 1 FROM public.companies c
  WHERE c.ats_type = 'greenhouse'
    AND lower(c.ats_identifier) = lower(s.identifier)
);
