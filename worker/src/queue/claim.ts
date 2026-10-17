import { loadConfig } from "../config.js";
import { db } from "../supabase.js";
import { ApplicationError } from "../utils/errors.js";

export interface QueueItem {
  id: string;
  user_id: string;
  job_id: string;
  attempt_id: string;
  batch_id: string | null;
}

export interface InspectionItem {
  id: string;
  url: string;
  mode: "inspect" | "dry_run";
  requested_by: string;
}

function fail(error: { message?: string } | null, operation: string): never {
  throw new ApplicationError("NETWORK_ERROR", `${operation} failed: ${error?.message ?? "unknown Supabase error"}`);
}

/** Atomically claims queued applications directly from Supabase. */
export async function claimApplications(limit = 1): Promise<QueueItem[]> {
  const config = loadConfig();
  const { data, error } = await db().rpc("claim_application", {
    _worker_id: config.WORKER_ID,
    _limit: Math.min(Math.max(limit, 1), 25),
  });
  if (error) fail(error, "claim_application");
  return (data ?? []) as QueueItem[];
}

export async function claimInspections(limit = 1): Promise<InspectionItem[]> {
  const config = loadConfig();
  const { data, error } = await db().rpc("claim_inspection", {
    _worker_id: config.WORKER_ID,
    _limit: Math.min(Math.max(limit, 1), 10),
  });
  if (error) fail(error, "claim_inspection");
  return (data ?? []) as InspectionItem[];
}

export async function reportStatus(queueId: string, status: string): Promise<void> {
  const { error } = await db().rpc("update_attempt_status", {
    _queue_id: queueId,
    _status: status,
  });
  if (error) fail(error, "update_attempt_status");
}

export async function reportSubmission(queueId: string, payload: Record<string, unknown>): Promise<void> {
  if (payload["verified"] !== true || !payload["verificationSignal"] || !payload["submissionReference"]) {
    const { error } = await db().rpc("update_attempt_status", {
      _queue_id: queueId,
      _status: "submitted_unverified",
    });
    if (error) fail(error, "mark submitted_unverified");
    return;
  }

  const { data: queueRow, error: queueError } = await db()
    .from("application_queue")
    .select("attempt_id")
    .eq("id", queueId)
    .maybeSingle();
  if (queueError) fail(queueError, "load application queue");

  const args: Record<string, unknown> = {
    _queue_id: queueId,
    _submission_reference: String(payload["submissionReference"]),
  };
  if (payload["evidencePath"]) args["_evidence_path"] = String(payload["evidencePath"]);

  const { error } = await db().rpc("complete_application", args);
  if (error) fail(error, "complete_application");

  if (queueRow?.attempt_id) {
    const { error: attemptError } = await db()
      .from("application_attempts")
      .update({
        verification_type: String(payload["verificationType"] ?? payload["verificationSignal"]),
        verification_value: String(payload["verificationValue"] ?? payload["submissionReference"]),
        resume_variant_id: payload["resumeVariantId"] ? String(payload["resumeVariantId"]) : null,
      })
      .eq("id", queueRow.attempt_id);
    if (attemptError) fail(attemptError, "update application attempt verification");
  }
}

export async function reportFailure(queueId: string, payload: Record<string, unknown>): Promise<void> {
  const errorCode = String(payload["errorCode"] ?? "unknown_error");
  const errorMessage = String(payload["errorMessage"] ?? "").slice(0, 1000);

  if (payload["retryable"] === true) {
    const { error } = await db().rpc("retry_application", {
      _queue_id: queueId,
      _delay_seconds: Math.min(Math.max(Number(payload["delaySeconds"] ?? 300), 30), 86400),
      _error_code: errorCode,
      _error_message: errorMessage,
    });
    if (error) fail(error, "retry_application");
    return;
  }

  const { error } = await db().rpc("fail_application", {
    _queue_id: queueId,
    _error_code: errorCode,
    _error_message: errorMessage,
    _status: String(payload["status"] ?? "failed_permanent"),
  });
  if (error) fail(error, "fail_application");
}

export async function reportInspection(inspectionId: string, payload: Record<string, unknown>): Promise<void> {
  const completedAt = new Date().toISOString();
  const status = String(payload["status"] ?? "completed");

  const { data: inspection, error: inspectionError } = await db()
    .from("adapter_inspections")
    .select("url")
    .eq("id", inspectionId)
    .maybeSingle();
  if (inspectionError) fail(inspectionError, "load inspection");

  const { error } = await db()
    .from("adapter_inspections")
    .update({
      status,
      adapter: payload["adapter"] ? String(payload["adapter"]) : null,
      ats_type: payload["atsType"] ? String(payload["atsType"]) : null,
      auto_apply_eligible: typeof payload["autoApplyEligible"] === "boolean" ? payload["autoApplyEligible"] : null,
      captcha_detected: typeof payload["captchaDetected"] === "boolean" ? payload["captchaDetected"] : null,
      login_required: typeof payload["loginRequired"] === "boolean" ? payload["loginRequired"] : null,
      required_fields: (payload["requiredFields"] ?? []) as never,
      mapped_fields: (payload["mappedFields"] ?? []) as never,
      unknown_fields: (payload["unknownFields"] ?? []) as never,
      reason: payload["reason"] ? String(payload["reason"]) : null,
      error_code: payload["errorCode"] ? String(payload["errorCode"]) : null,
      error_message: payload["errorMessage"] ? String(payload["errorMessage"]) : null,
      completed_at: completedAt,
    })
    .eq("id", inspectionId);
  if (error) fail(error, "report inspection");

  // A failed infrastructure/network inspection should be retried later and must
  // not change job eligibility. Only a completed inspection is authoritative.
  if (status !== "completed" || !inspection?.url) return;

  const adapter = payload["adapter"] ? String(payload["adapter"]) : "unsupported";
  const eligible = payload["autoApplyEligible"] === true;
  const reason = payload["reason"] ? String(payload["reason"]) : eligible ? null : "FORM_NOT_SUPPORTED";

  const { data: jobs, error: jobsError } = await db()
    .from("jobs")
    .select("id,application_schema_id")
    .eq("application_url", inspection.url)
    .eq("is_active", true);
  if (jobsError) fail(jobsError, "load inspected jobs");

  for (const job of jobs ?? []) {
    let schemaId = job.application_schema_id as string | null;

    const schemaRow = {
      job_id: job.id,
      adapter,
      schema_version: String(payload["adapterVersion"] ?? "1"),
      fields: (payload["fields"] ?? []) as never,
      required_fields: (payload["requiredFields"] ?? []) as never,
      supports_file_upload: payload["supportsFileUpload"] === true,
      supports_auto_submit: payload["supportsAutoSubmit"] === true,
      last_verified_at: completedAt,
      valid: eligible,
    };

    if (schemaId) {
      const { error: schemaError } = await db()
        .from("application_schemas")
        .update(schemaRow)
        .eq("id", schemaId);
      if (schemaError) fail(schemaError, "update application schema");
    } else {
      const { data: schema, error: schemaError } = await db()
        .from("application_schemas")
        .insert(schemaRow)
        .select("id")
        .single();
      if (schemaError || !schema) fail(schemaError, "create application schema");
      schemaId = schema.id;
    }

    const { error: jobError } = await db()
      .from("jobs")
      .update({
        auto_apply_eligible: eligible,
        auto_apply_adapter: adapter === "unsupported" ? null : adapter,
        application_schema_id: schemaId,
        last_verified_at: completedAt,
        submission_mechanism: eligible ? "public_form" : "manual",
        ineligibility_reason: eligible ? null : reason,
      })
      .eq("id", job.id);
    if (jobError) fail(jobError, "update inspected job");
  }
}
