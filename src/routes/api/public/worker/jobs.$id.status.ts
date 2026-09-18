import { createFileRoute } from "@tanstack/react-router";
import {
  assertWorker,
  jsonResponse,
  loadOwnedQueue,
  workerDb,
} from "@/lib/worker-api.server";

const allowed = [
  "preparing",
  "resume_generating",
  "ready",
  "submitting",
  "submitted_unverified",
];

/** POST /api/public/worker/jobs/:id/status — :id is the application_queue id. */
export const Route = createFileRoute("/api/public/worker/jobs/$id/status")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const auth = assertWorker(request);
        if (auth) return auth;

        const body = (await request.json().catch(() => ({}))) as {
          status?: string;
          worker_id?: string;
        };
        if (!body.status || !allowed.includes(body.status)) {
          return jsonResponse({ error: "invalid_status", allowed }, 400);
        }
        const workerId = (body.worker_id ?? "").slice(0, 64);
        if (!workerId) return jsonResponse({ error: "worker_id_required" }, 400);

        const db = workerDb();
        const owned = await loadOwnedQueue(db, params.id, workerId);
        if (!owned) return jsonResponse({ error: "not_owned" }, 403);

        const { data, error } = await db.rpc("update_attempt_status", {
          _queue_id: params.id,
          _status: body.status,
        });
        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({ result: data });
      },
    },
  },
});
