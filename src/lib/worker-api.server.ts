import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Token-based worker contract.
 *
 * The external Auto Apply worker is an untrusted execution boundary: it never
 * receives database credentials, never gets arbitrary reads, and only ever sees
 * the data belonging to the single application it currently owns.
 */

export const RESUME_BUCKET = "resumes";
export const EVIDENCE_BUCKET = "application-evidence";

/** A processing lock older than this is considered abandoned. */
export const LOCK_TIMEOUT_MINUTES = 10;
export const MAX_ATTEMPTS = 4;
export const UPLOAD_URL_TTL_SECONDS = 7200;

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

/**
 * Accepted credentials, in rotation order. AUTO_APPLY_WORKER_TOKEN_PREVIOUS is
 * optional and only meant to stay valid during a short rotation window.
 */
function acceptedTokens(): string[] {
  return [
    process.env["AUTO_APPLY_WORKER_TOKEN_CURRENT"],
    process.env["AUTO_APPLY_WORKER_TOKEN"],
    process.env["AUTO_APPLY_WORKER_TOKEN_PREVIOUS"],
    // Legacy name from the first contract; kept so a deployed worker is not cut off.
    process.env["WORKER_SERVICE_TOKEN"],
  ].filter((value): value is string => typeof value === "string" && value.length >= 20);
}

/** Returns a Response when the caller must be rejected, or null when authorized. */
export function assertWorker(request: Request): Response | null {
  const tokens = acceptedTokens();
  if (!tokens.length) return jsonResponse({ error: "worker_service_not_configured" }, 503);
  const header = request.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!presented) return jsonResponse({ error: "unauthorized" }, 401);
  const ok = tokens.some((token) => constantTimeEquals(presented, token));
  return ok ? null : jsonResponse({ error: "unauthorized" }, 401);
}

export function workerDb() {
  return createClient<Database>(process.env["SUPABASE_URL"]!, process.env["SUPABASE_SERVICE_ROLE_KEY"]!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Structured worker log: identifiers only, never personal data or answers. */
export function workerLog(event: string, fields: Record<string, string | number | boolean | null | undefined>) {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) if (value !== undefined) safe[key] = value;
  console.info(JSON.stringify({ scope: "auto_apply_worker", event, ...safe }));
}

export type WorkerDb = ReturnType<typeof workerDb>;

export interface OwnedAttempt {
  queueId: string;
  attemptId: string;
  userId: string;
  jobId: string;
  batchId: string | null;
  attempts: number;
  workerId: string | null;
  status: string;
  attemptStatus: string;
  testMode: boolean;
}

export interface OwnedQueue {
  queueId: string;
  attemptId: string;
  userId: string;
  jobId: string;
  batchId: string | null;
  attempts: number;
  workerId: string | null;
  status: string;
  testMode: boolean;
}

/** Resolves a queue row only when it is currently owned by the caller. */
export async function loadOwnedQueue(
  db: WorkerDb,
  queueId: string,
  workerId: string,
): Promise<OwnedQueue | null> {
  if (!queueId || !workerId) return null;
  const { data: queue } = await db
    .from("application_queue")
    .select("id, user_id, job_id, batch_id, attempts, worker_id, status, attempt_id, test_mode")
    .eq("id", queueId)
    .eq("worker_id", workerId)
    .maybeSingle();

  if (!queue?.attempt_id) return null;
  return {
    queueId: queue.id,
    attemptId: queue.attempt_id,
    userId: queue.user_id,
    jobId: queue.job_id,
    batchId: queue.batch_id ?? null,
    attempts: queue.attempts ?? 0,
    workerId: queue.worker_id ?? null,
    status: queue.status,
    testMode: queue.test_mode === true,
  };
}

/**
 * Resolves the queue row a worker currently owns from the attempt id. Any
 * operation outside the worker's own claimed attempt is rejected here.
 */
export async function loadOwnedAttempt(db: WorkerDb, attemptId: string, workerId?: string): Promise<OwnedAttempt | null> {
  if (!attemptId) return null;
  const { data: queue } = await db
    .from("application_queue")
    .select("id, user_id, job_id, batch_id, attempts, worker_id, status, attempt_id, test_mode")
    .eq("attempt_id", attemptId)
    .maybeSingle();
  const { data: attempt } = await db
    .from("application_attempts")
    .select("id, user_id, job_id, batch_id, status, test_mode")
    .eq("id", attemptId)
    .maybeSingle();
  if (!attempt) return null;
  if (workerId && queue && queue.worker_id && queue.worker_id !== workerId) return null;

  return {
    queueId: queue?.id ?? "",
    attemptId: attempt.id,
    userId: attempt.user_id,
    jobId: attempt.job_id,
    batchId: attempt.batch_id ?? queue?.batch_id ?? null,
    attempts: queue?.attempts ?? 0,
    workerId: queue?.worker_id ?? null,
    status: queue?.status ?? "gone",
    attemptStatus: attempt.status,
    testMode: queue?.test_mode === true || attempt.test_mode === true,
  };
}

export async function audit(db: WorkerDb, owned: { userId: string; jobId: string; attemptId: string }, eventType: string, metadata: Record<string, unknown> = {}) {
  await db.from("application_audit_log").insert({
    user_id: owned.userId,
    job_id: owned.jobId,
    application_attempt_id: owned.attemptId,
    event_type: eventType,
    metadata: metadata as never,
  });
}

/** Errors the worker must never retry: the blocker will not disappear. */
export const PERMANENT_ERRORS = [
  "CAPTCHA_PRESENT",
  "LOGIN_REQUIRED",
  "AUTOMATION_BLOCKED",
  "UNSUPPORTED_FIELD",
  "PROFILE_INCOMPLETE",
  "DRY_RUN_COMPLETE",
  "JOB_EXPIRED",
  "DUPLICATE_APPLICATION",
];

/** Errors that may be transient and are worth a backed-off retry. */
export const TRANSIENT_ERRORS = ["NETWORK_ERROR", "ATS_TEMPORARY_ERROR", "TIMEOUT", "RATE_LIMITED", "FORM_CHANGED", "FILE_UPLOAD_FAILED"];

/** 1 min → 5 min → 20 min → 1 h, with jitter so retries never thunder together. */
export function backoffSeconds(attempts: number): number {
  const ladder = [60, 300, 1200, 3600];
  const base = ladder[Math.min(Math.max(attempts - 1, 0), ladder.length - 1)] ?? 3600;
  return Math.round(base * (0.85 + Math.random() * 0.3));
}

/** Errors that take the job out of Auto Apply inventory altogether. */
export function makesJobUnsupported(code: string): boolean {
  return ["CAPTCHA_PRESENT", "LOGIN_REQUIRED", "AUTOMATION_BLOCKED", "UNSUPPORTED_FIELD"].includes(code);
}

/**
 * Returns abandoned work to the queue. Runs opportunistically on every claim so
 * a crashed worker never parks an application forever.
 */
export async function requeueStaleLocks(db: WorkerDb): Promise<number> {
  const threshold = new Date(Date.now() - LOCK_TIMEOUT_MINUTES * 60_000).toISOString();
  const { data: stale } = await db
    .from("application_queue")
    .select("id, attempts, attempt_id, user_id, job_id")
    .eq("status", "processing")
    .lt("locked_at", threshold)
    .limit(25);
  if (!stale?.length) return 0;

  for (const row of stale) {
    if (row.attempts >= MAX_ATTEMPTS) {
      await db.rpc("fail_application", {
        _queue_id: row.id,
        _error_code: "TIMEOUT",
        _error_message: "El servicio de envío dejó de responder y se agotaron los intentos.",
        _status: "failed_permanent",
      });
      workerLog("stale_lock_failed", { queue_id: row.id, job_id: row.job_id, attempts: row.attempts });
      continue;
    }
    await db.rpc("retry_application", {
      _queue_id: row.id,
      _delay_seconds: backoffSeconds(row.attempts),
      _error_code: "TIMEOUT",
      _error_message: "Se recuperó una postulación con bloqueo vencido.",
    });
    workerLog("stale_lock_requeued", { queue_id: row.id, job_id: row.job_id, attempts: row.attempts });
  }
  return stale.length;
}
