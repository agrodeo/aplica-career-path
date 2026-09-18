import { createFileRoute } from "@tanstack/react-router";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}

function constantTimeEquals(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

function authorize(request: Request) {
  const expected = process.env["DISCOVERY_CRON_TOKEN"];
  if (!expected || expected.length < 20) {
    return json({ error: "discovery_cron_not_configured" }, 503);
  }

  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ")
    ? header.slice(7).trim()
    : "";

  if (!provided || !constantTimeEquals(provided, expected)) {
    return json({ error: "unauthorized" }, 401);
  }
  return null;
}

export const Route = createFileRoute("/api/public/discovery/sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = authorize(request);
        if (auth) return auth;

        const body = (await request.json().catch(() => ({}))) as {
          limit?: number;
        };
        const limit = Math.max(
          1,
          Math.min(Number.isFinite(body.limit) ? Number(body.limit) : 20, 50),
        );

        const { syncDueGreenhouseBoards } = await import(
          "@/lib/discovery.server"
        );

        const startedAt = new Date().toISOString();
        const result = await syncDueGreenhouseBoards(limit);

        return json({
          ok: result.failed === 0,
          startedAt,
          completedAt: new Date().toISOString(),
          ...result,
        });
      },
    },
  },
});
