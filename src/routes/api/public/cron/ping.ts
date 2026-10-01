import { createFileRoute } from "@tanstack/react-router";
import { assertCronCaller } from "@/lib/cron-auth.server";
import { jsonResponse } from "@/lib/worker-auth.server";

/**
 * Health/check endpoint for external schedulers. Verifies that the caller
 * holds CRON_API_TOKEN. Extend this handler (or add sibling routes under
 * /api/public/cron/) with the actual cron work.
 */
export const Route = createFileRoute("/api/public/cron/ping")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rejected = assertCronCaller(request);
        if (rejected) return rejected;
        return jsonResponse({ ok: true, at: new Date().toISOString() });
      },
    },
  },
});
