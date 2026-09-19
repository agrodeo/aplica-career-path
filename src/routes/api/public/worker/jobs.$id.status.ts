import { createFileRoute } from "@tanstack/react-router";
import { assertWorker, jsonResponse, workerAdmin } from "@/lib/worker-auth.server";

const allowed = ["preparing", "resume_generating", "ready", "submitting", "submitted_unverified"];

/** POST /api/public/worker/jobs/:id/status — :id is the application_queue id. */
export const Route = createFileRoute("/api/public/worker/jobs/$id/status")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const auth = assertWorker(request);
        if (auth) return auth;
        const body = (await request.json().catch(() => ({}))) as { status?: string };
        if (!body.status || !allowed.includes(body.status)) return jsonResponse({ error: "invalid_status", allowed }, 400);

        const admin = await workerAdmin();
        const { data, error } = await admin.rpc("update_attempt_status", { _queue_id: params.id, _status: body.status });
        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({ result: data });
      },
    },
  },
});
