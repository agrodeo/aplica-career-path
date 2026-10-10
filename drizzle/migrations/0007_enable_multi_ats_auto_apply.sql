INSERT INTO public.adapter_registry (
  adapter,
  label,
  discovery,
  schema_discovery,
  submission,
  verification,
  public_discovery_supported,
  authorized_submission_supported,
  public_form_submission_supported,
  connection_status,
  health,
  updated_at
)
VALUES
  ('greenhouse', 'Greenhouse', true, true, true, true, true, false, true, 'connected', 'healthy', now()),
  ('lever', 'Lever', true, true, true, true, true, false, true, 'connected', 'healthy', now()),
  ('ashby', 'Ashby', true, true, true, true, true, false, true, 'connected', 'healthy', now()),
  ('workable', 'Workable', true, true, true, true, true, false, true, 'connected', 'healthy', now()),
  ('smartrecruiters', 'SmartRecruiters', true, true, true, true, true, false, true, 'connected', 'healthy', now()),
  ('workday', 'Workday', true, true, true, true, true, false, true, 'connected', 'healthy', now())
ON CONFLICT (adapter) DO UPDATE SET
  discovery = EXCLUDED.discovery,
  schema_discovery = EXCLUDED.schema_discovery,
  submission = EXCLUDED.submission,
  verification = EXCLUDED.verification,
  public_discovery_supported = EXCLUDED.public_discovery_supported,
  public_form_submission_supported = EXCLUDED.public_form_submission_supported,
  connection_status = EXCLUDED.connection_status,
  health = EXCLUDED.health,
  updated_at = now();
