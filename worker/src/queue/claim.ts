import { loadConfig } from "../config.js";
import { db } from "../supabase.js";
import { ApplicationError } from "../utils/errors.js";
import { recoverableDatabaseCall } from "../utils/database-retry.js";
import { InspectionLeaseLostError } from "./inspection-outbox.js";

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
  const { data, error } = await recoverableDatabaseCall(() => db().rpc("claim_inspection_batch", {
    _worker_id: config.WORKER_ID,
    _limit: Math.min(Math.max(limit, 1), 120),
    _ats_type: config.INSPECTION_PROVIDER === "all" ? null : config.INSPECTION_PROVIDER,
  }), "claim_inspection_batch");
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

export async function reportInspection(inspectionId: string, payload: Record<string, unknown>, workerId?: string): Promise<void> {
  const config = loadConfig();
  const { error } = await recoverableDatabaseCall(() => db().rpc("report_inspection_result", {
    _inspection_id: inspectionId,
    _worker_id: workerId ?? config.WORKER_ID,
    _payload: payload,
  }), "report_inspection_result");
  if (error?.code === "P0001" && /Inspection (?:lease is not owned|not found|is not running)/i.test(error.message)) {
    throw new InspectionLeaseLostError(error.message);
  }
  if (error) fail(error, "report_inspection_result");
}
