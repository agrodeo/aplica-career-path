-- Provider-specific claims avoid sorting or walking the full inspection queue.
CREATE INDEX IF NOT EXISTS adapter_inspections_provider_claim_idx
ON public.adapter_inspections (ats_type, created_at, id) WHERE status = 'queued';

CREATE OR REPLACE FUNCTION public.claim_inspection_batch(_worker_id text, _limit integer DEFAULT 1, _ats_type text DEFAULT NULL)
RETURNS SETOF public.adapter_inspections
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE _provider text := _ats_type;
BEGIN
  IF nullif(trim(_worker_id),'') IS NULL THEN RAISE EXCEPTION 'Worker ID required'; END IF;
  IF _provider IS NOT NULL AND _provider NOT IN ('greenhouse','ashby','workable','smartrecruiters','workday','lever') THEN
    RAISE EXCEPTION 'Unsupported inspection provider';
  END IF;
  UPDATE public.adapter_inspections SET status='queued',worker_id=NULL,locked_at=NULL
    WHERE status='running' AND locked_at < now()-interval '25 minutes';
  -- A lost HTTP response must return the same lease on retry, not claim more work.
  IF EXISTS (SELECT 1 FROM public.adapter_inspections WHERE status='running' AND worker_id=_worker_id) THEN
    RETURN QUERY SELECT i.* FROM public.adapter_inspections i WHERE i.status='running' AND i.worker_id=_worker_id
      ORDER BY i.created_at,i.id LIMIT LEAST(GREATEST(_limit,1),120);
    RETURN;
  END IF;
  IF _provider IS NULL THEN
    SELECT p.provider INTO _provider FROM unnest(ARRAY['greenhouse','ashby','workable','smartrecruiters','workday','lever'])
      WITH ORDINALITY AS p(provider,priority)
      WHERE EXISTS (SELECT 1 FROM public.adapter_inspections i WHERE i.status='queued' AND i.ats_type=p.provider)
      ORDER BY p.priority LIMIT 1;
  END IF;
  RETURN QUERY WITH picked AS (
    SELECT i.id FROM public.adapter_inspections i WHERE i.status='queued' AND i.ats_type=_provider
    ORDER BY i.created_at,i.id FOR UPDATE SKIP LOCKED LIMIT LEAST(GREATEST(_limit,1),120)
  ) UPDATE public.adapter_inspections i SET status='running',worker_id=_worker_id,locked_at=now()
    FROM picked WHERE i.id=picked.id RETURNING i.*;
END; $$;
REVOKE ALL ON FUNCTION public.claim_inspection_batch(text,integer,text) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_inspection_batch(text,integer,text) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_inspection(_worker_id text,_limit integer DEFAULT 1)
RETURNS SETOF public.adapter_inspections LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  SELECT * FROM public.claim_inspection_batch(_worker_id,_limit,NULL);
$$;
REVOKE ALL ON FUNCTION public.claim_inspection(text,integer) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_inspection(text,integer) TO service_role;

-- Report, schema and job eligibility commit together. The worker owns the lease;
-- stale workers cannot overwrite a newer inspection, and retries are idempotent.
CREATE OR REPLACE FUNCTION public.report_inspection_result(_inspection_id uuid,_worker_id text,_payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  _inspection public.adapter_inspections%ROWTYPE;
  _status text := coalesce(_payload->>'status','completed');
  _at timestamptz := now();
  _job record;
  _schema_id uuid;
  _adapter text := coalesce(nullif(_payload->>'adapter',''),'unsupported');
  _eligible boolean := coalesce((_payload->>'autoApplyEligible')::boolean,false);
BEGIN
  SELECT * INTO _inspection FROM public.adapter_inspections WHERE id=_inspection_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inspection not found'; END IF;
  IF _inspection.worker_id IS DISTINCT FROM _worker_id OR nullif(_worker_id,'') IS NULL THEN
    RAISE EXCEPTION 'Inspection lease is not owned by this worker';
  END IF;
  IF _inspection.status IN ('completed','failed') THEN RETURN; END IF;
  IF _inspection.status<>'running' THEN RAISE EXCEPTION 'Inspection is not running'; END IF;
  IF _status NOT IN ('completed','failed') THEN RAISE EXCEPTION 'Invalid inspection result'; END IF;

  IF _status='completed' THEN
    FOR _job IN SELECT id,application_schema_id FROM public.jobs WHERE application_url=_inspection.url AND is_active FOR UPDATE LOOP
      _schema_id := _job.application_schema_id;
      IF _schema_id IS NOT NULL THEN
        UPDATE public.application_schemas SET adapter=_adapter,schema_version=coalesce(_payload->>'adapterVersion','1'),
          fields=coalesce(_payload->'fields','[]'::jsonb),required_fields=coalesce(_payload->'requiredFields','[]'::jsonb),
          supports_file_upload=coalesce((_payload->>'supportsFileUpload')::boolean,false),
          supports_auto_submit=coalesce((_payload->>'supportsAutoSubmit')::boolean,false),last_verified_at=_at,valid=_eligible
          WHERE id=_schema_id;
        IF NOT FOUND THEN _schema_id := NULL; END IF;
      END IF;
      IF _schema_id IS NULL THEN
        INSERT INTO public.application_schemas(job_id,adapter,schema_version,fields,required_fields,supports_file_upload,supports_auto_submit,last_verified_at,valid)
        VALUES(_job.id,_adapter,coalesce(_payload->>'adapterVersion','1'),coalesce(_payload->'fields','[]'::jsonb),
          coalesce(_payload->'requiredFields','[]'::jsonb),coalesce((_payload->>'supportsFileUpload')::boolean,false),
          coalesce((_payload->>'supportsAutoSubmit')::boolean,false),_at,_eligible) RETURNING id INTO _schema_id;
      END IF;
      UPDATE public.jobs SET auto_apply_eligible=_eligible,auto_apply_adapter=nullif(_adapter,'unsupported'),
        application_schema_id=_schema_id,last_verified_at=_at,submission_mechanism=CASE WHEN _eligible THEN 'public_form' ELSE 'manual' END,
        ineligibility_reason=CASE WHEN _eligible THEN NULL ELSE coalesce(_payload->>'reason','FORM_NOT_SUPPORTED') END WHERE id=_job.id;
    END LOOP;
  END IF;
  UPDATE public.adapter_inspections SET status=_status,adapter=nullif(_payload->>'adapter',''),
    ats_type=coalesce(nullif(_payload->>'atsType',''),ats_type),auto_apply_eligible=(_payload->>'autoApplyEligible')::boolean,
    captcha_detected=(_payload->>'captchaDetected')::boolean,login_required=(_payload->>'loginRequired')::boolean,
    required_fields=coalesce(_payload->'requiredFields','[]'::jsonb),mapped_fields=coalesce(_payload->'mappedFields','[]'::jsonb),
    unknown_fields=coalesce(_payload->'unknownFields','[]'::jsonb),reason=nullif(_payload->>'reason',''),
    error_code=nullif(_payload->>'errorCode',''),error_message=left(_payload->>'errorMessage',1000),completed_at=_at
    WHERE id=_inspection_id;
END; $$;
REVOKE ALL ON FUNCTION public.report_inspection_result(uuid,text,jsonb) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.report_inspection_result(uuid,text,jsonb) TO service_role;
