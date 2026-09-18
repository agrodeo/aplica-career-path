import { createFileRoute } from "@tanstack/react-router";
import { assertWorker, jsonResponse, workerDb } from "@/lib/worker-api.server";

/** POST /api/public/worker/inspections/claim — admin adapter test console work. */
export const Route = createFileRoute("/api/public/worker/inspections/claim")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = assertWorker(request);
        if (auth) return auth;

        const body = (await request.json().catch(() => ({}))) as {
          workerId?: string;
          worker_id?: string;
          limit?: number;
        };
        const workerId = (body.worker_id ?? body.workerId ?? "").slice(0, 64);
        if (!workerId) {
          return jsonResponse({ error: "worker_id_required" }, 400);
        }

        const db = workerDb();
        const { data, error } = await db.rpc("claim_inspection", {
          _worker_id: workerId,
          _limit: Math.min(Math.max(body.limit ?? 1, 1), 10),
        });
        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({ claimed: data ?? [] });
      },
    },
  },
});
