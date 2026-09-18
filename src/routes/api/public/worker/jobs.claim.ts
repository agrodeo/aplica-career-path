import { createFileRoute } from "@tanstack/react-router";
import { assertWorker, jsonResponse, workerAdmin } from "@/lib/worker-auth.server";

/** POST /api/public/worker/jobs/claim — atomically claims queued applications. */
export const Route = createFileRoute("/api/public/worker/jobs/claim")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = assertWorker(request);
        if (auth) return auth;
        const body = (await request.json().catch(() => ({}))) as { workerId?: string; limit?: number };
        const workerId = body.workerId?.slice(0, 64);
        if (!workerId) return jsonResponse({ error: "workerId is required" }, 400);
        const limit = Math.min(Math.max(body.limit ?? 1, 1), 25);

        const admin = await workerAdmin();
        const { data, error } = await admin.rpc("claim_application", { _worker_id: workerId, _limit: limit });
        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({ claimed: data ?? [] });
      },
    },
  },
});
