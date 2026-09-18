import { createFileRoute } from "@tanstack/react-router";
import { assertWorker, jsonResponse, loadOwnedAttempt, workerDb } from "@/lib/worker-api.server";

/**
 * POST /api/public/worker/heartbeat
 * Extends the processing lock of an application the caller already owns, so a
 * long but healthy submission is never reclaimed by another worker.
 */
export const Route = createFileRoute("/api/public/worker/heartbeat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = assertWorker(request);
        if (auth) return auth;
        const body = (await request.json().catch(() => ({}))) as { application_attempt_id?: string; worker_id?: string };
        const attemptId = body.application_attempt_id ?? "";
        const workerId = (body.worker_id ?? "").slice(0, 64);
        if (!attemptId || !workerId) return jsonResponse({ error: "application_attempt_id_and_worker_id_required" }, 400);

        const db = workerDb();
        const owned = await loadOwnedAttempt(db, attemptId, workerId);
        if (!owned || !owned.queueId) return jsonResponse({ error: "not_owned" }, 403);
        if (owned.workerId !== workerId) return jsonResponse({ error: "not_owned" }, 403);

        const { error } = await db.from("application_queue").update({ locked_at: new Date().toISOString() }).eq("id", owned.queueId).eq("worker_id", workerId);
        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({ ok: true, lock_extended_seconds: 600 });
      },
    },
  },
});
