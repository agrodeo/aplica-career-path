WITH seed(name, identifier, careers_url) AS (
  VALUES
    ('Canonical','canonical','https://job-boards.greenhouse.io/canonical'),
    ('Cloudflare','cloudflare','https://job-boards.greenhouse.io/cloudflare')
)
INSERT INTO public.companies (
  name, careers_url, ats_type, ats_identifier, auto_apply_supported, active
)
SELECT s.name, s.careers_url, 'greenhouse', s.identifier, true, true
FROM seed s
WHERE NOT EXISTS (
  SELECT 1 FROM public.companies c
  WHERE c.ats_type='greenhouse'
    AND lower(c.ats_identifier)=lower(s.identifier)
);
