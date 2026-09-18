import { createFileRoute } from "@tanstack/react-router";
import { assertWorker, jsonResponse, workerAdmin } from "@/lib/worker-auth.server";

/** POST /api/public/worker/jobs/:id/failure — retryable or permanent failure. */
export const Route = createFileRoute("/api/public/worker/jobs/$id/failure")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const auth = assertWorker(request);
        if (auth) return auth;
        const body = (await request.json().catch(() => ({}))) as {
          errorCode?: string;
          errorMessage?: string;
          retryable?: boolean;
          delaySeconds?: number;
          status?: "failed_permanent" | "expired" | "unsupported";
        };
        const errorCode = body.errorCode ?? "unknown_error";
        const errorMessage = (body.errorMessage ?? "").slice(0, 1000);

        const admin = await workerAdmin();
        if (body.retryable) {
          const { data, error } = await admin.rpc("retry_application", {
            _queue_id: params.id,
            _delay_seconds: Math.min(Math.max(body.delaySeconds ?? 300, 30), 86400),
            _error_code: errorCode,
            _error_message: errorMessage,
          });
          if (error) return jsonResponse({ error: error.message }, 500);
          return jsonResponse({ result: data });
        }

        const { data, error } = await admin.rpc("fail_application", {
          _queue_id: params.id,
          _error_code: errorCode,
          _error_message: errorMessage,
          _status: body.status ?? "failed_permanent",
        });
        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({ result: data });
      },
    },
  },
});
