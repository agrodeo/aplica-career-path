import { createFileRoute } from "@tanstack/react-router";
import { assertWorker, audit, jsonResponse, requeueStaleLocks, workerDb, workerLog } from "@/lib/worker-api.server";
import { buildApplicationPayload } from "@/lib/worker-payload.server";

/**
 * POST /api/public/worker/claim-application
 * Atomically claims ONE queued application and returns the complete payload
 * needed to process it. No other endpoint exposes user data.
 */
export const Route = createFileRoute("/api/public/worker/claim-application")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = assertWorker(request);
        if (auth) return auth;
        const body = (await request.json().catch(() => ({}))) as { worker_id?: string; workerId?: string };
        const workerId = (body.worker_id ?? body.workerId ?? "").slice(0, 64);
        if (!workerId) return jsonResponse({ error: "worker_id_required" }, 400);

        const db = workerDb();
        await requeueStaleLocks(db);

        const { data, error } = await db.rpc("claim_application", { _worker_id: workerId, _limit: 1 });
        if (error) return jsonResponse({ error: error.message }, 500);
        const queue = (data ?? [])[0];
        if (!queue) return jsonResponse({ claimed: null });

        const payload = await buildApplicationPayload(db, {
          id: queue.id,
          user_id: queue.user_id,
          job_id: queue.job_id,
          attempt_id: queue.attempt_id,
          batch_id: queue.batch_id,
          attempts: queue.attempts,
          test_mode: queue.test_mode === true,
        });

        if ("error" in payload) {
          await db.rpc("fail_application", {
            _queue_id: queue.id,
            _error_code: payload.error === "job_not_found" ? "JOB_EXPIRED" : "UNSUPPORTED_FIELD",
            _error_message: payload.error === "job_not_found" ? "La vacante ya no existe." : "El usuario todavía no tiene un perfil de carrera.",
            _status: payload.error === "job_not_found" ? "expired" : "failed_permanent",
          });
          workerLog("claim_rejected", { worker_id: workerId, queue_id: queue.id, reason: payload.error });
          return jsonResponse({ claimed: null, skipped: payload.error });
        }

        if (!payload.job.is_active || !payload.job.auto_apply_eligible || !payload.job.application_url) {
          await db.rpc("fail_application", {
            _queue_id: queue.id,
            _error_code: "JOB_EXPIRED",
            _error_message: "La vacante dejó de estar disponible para envío automático.",
            _status: "expired",
          });
          return jsonResponse({ claimed: null, skipped: "job_not_eligible" });
        }

        const { data: verifiedDuplicate } = await db
          .from("application_attempts")
          .select("id")
          .eq("user_id", queue.user_id)
          .eq("job_id", queue.job_id)
          .eq("status", "verified")
          .neq("id", queue.attempt_id)
          .limit(1)
          .maybeSingle();

        if (verifiedDuplicate && queue.test_mode !== true) {
          await db.rpc("fail_application", {
            _queue_id: queue.id,
            _error_code: "DUPLICATE_APPLICATION",
            _error_message: "Ya existe una postulación verificada para esta vacante.",
            _status: "duplicate",
          });
          workerLog("claim_rejected", {
            worker_id: workerId,
            queue_id: queue.id,
            reason: "duplicate_application",
          });
          return jsonResponse({ claimed: null, skipped: "duplicate_application" });
        }
        if (!payload.consent?.authorized || payload.consent.revoked_at) {
          await db.rpc("fail_application", { _queue_id: queue.id, _error_code: "UNSUPPORTED_FIELD", _error_message: "Falta la autorización del usuario para postular por él.", _status: "failed_permanent" });
          return jsonResponse({ claimed: null, skipped: "consent_missing" });
        }

        await db.rpc("update_attempt_status", { _queue_id: queue.id, _status: "preparing" });
        await audit(db, { userId: queue.user_id, jobId: queue.job_id, attemptId: queue.attempt_id }, "worker_claimed", { worker_id: workerId, attempt: queue.attempts });
        workerLog("claimed", { worker_id: workerId, application_attempt_id: queue.attempt_id, job_id: queue.job_id, attempt: queue.attempts });

        return jsonResponse({ claimed: payload });
      },
    },
  },
});
