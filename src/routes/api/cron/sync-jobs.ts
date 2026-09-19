import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/cron/sync-jobs")({
  server: {
    handlers: {
      GET: handleSync,
      POST: handleSync,
    },
  },
});

async function handleSync({ request }: { request: Request }) {
  const auth = await authenticateCronRequest(request);
  if (auth) return auth;

  const { supabaseAdmin } = await import(
    "@/integrations/supabase/client.server"
  );
  const { syncAllRegisteredJobSources } = await import(
    "@/lib/job-sync.server"
  );

  const { data: adminRole } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();

  const result = await syncAllRegisteredJobSources({
    requestedBy: adminRole?.user_id ?? null,
    concurrency: 4,
  });

  return new Response(
    JSON.stringify({
      ok: result.failed === 0,
      syncedAt: new Date().toISOString(),
      ...result,
    }),
    {
      status: result.failed === 0 ? 200 : 207,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    },
  );
}
