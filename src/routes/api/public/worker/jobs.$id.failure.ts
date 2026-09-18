import { createFileRoute } from "@tanstack/react-router";
import {
  PERMANENT_ERRORS,
  TRANSIENT_ERRORS,
  assertWorker,
  backoffSeconds,
  jsonResponse,
  loadOwnedQueue,
  makesJobUnsupported,
  workerDb,
  workerLog,
} from "@/lib/worker-api.server";

const finalStatuses = [
  "failed_permanent",
  "expired",
  "unsupported",
  "duplicate",
] as const;

/** POST /api/public/worker/jobs/:id/failure — retryable or permanent failure. */
export const Route = createFileRoute("/api/public/worker/jobs/$id/failure")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const auth = assertWorker(request);
        if (auth) return auth;

        const body = (await request.json().catch(() => ({}))) as {
          worker_id?: string;
          errorCode?: string;
          errorMessage?: string;
          retryable?: boolean;
          delaySeconds?: number;
          status?: (typeof finalStatuses)[number];
        };

        const workerId = (body.worker_id ?? "").slice(0, 64);
        if (!workerId) return jsonResponse({ error: "worker_id_required" }, 400);

        const errorCode = String(body.errorCode ?? "UNKNOWN_ERROR").slice(0, 80);
        const errorMessage = String(body.errorMessage ?? "").slice(0, 1000);
        const db = workerDb();
        const owned = await loadOwnedQueue(db, params.id, workerId);
        if (!owned) return jsonResponse({ error: "not_owned" }, 403);

        const transient = TRANSIENT_ERRORS.includes(errorCode);
        const permanent = PERMANENT_ERRORS.includes(errorCode);
        const retryable =
          transient &&
          !permanent &&
          owned.attempts < 4 &&
          body.retryable !== false;

        if (retryable) {
          const delay = Math.min(
            Math.max(body.delaySeconds ?? backoffSeconds(owned.attempts), 30),
            86400,
          );
          const { data, error } = await db.rpc("retry_application", {
            _queue_id: params.id,
            _delay_seconds: delay,
            _error_code: errorCode,
            _error_message: errorMessage,
          });
          if (error) return jsonResponse({ error: error.message }, 500);
          workerLog("application_retry_scheduled", {
            queue_id: params.id,
            job_id: owned.jobId,
            attempts: owned.attempts,
          });
          return jsonResponse({ result: data });
        }

        let status: (typeof finalStatuses)[number] =
          body.status && finalStatuses.includes(body.status)
            ? body.status
            : "failed_permanent";
        if (errorCode === "JOB_EXPIRED") status = "expired";
        if (errorCode === "DUPLICATE_APPLICATION") status = "duplicate";
        if (makesJobUnsupported(errorCode)) status = "unsupported";

        if (makesJobUnsupported(errorCode)) {
          await db
            .from("jobs")
            .update({
              auto_apply_eligible: false,
              submission_mechanism: "UNSUPPORTED",
              ineligibility_reason: errorCode,
            })
            .eq("id", owned.jobId);
        }

        const { data, error } = await db.rpc("fail_application", {
          _queue_id: params.id,
          _error_code: errorCode,
          _error_message: errorMessage,
          _status: status,
        });
        if (error) return jsonResponse({ error: error.message }, 500);

        workerLog("application_failed", {
          queue_id: params.id,
          job_id: owned.jobId,
          error_code: errorCode,
        });
        return jsonResponse({ result: data });
      },
    },
  },
});
