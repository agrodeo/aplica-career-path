import { supabaseAdmin } from "../src/integrations/supabase/client.server";
import { syncAllRegisteredJobSources } from "../src/lib/job-sync.server";

const SYSTEM_INSPECTION_REQUESTER = "00000000-0000-0000-0000-000000000001";

// worldwide inventory wave 15 + expanded LATAM coverage
async function main() {
  const { data: adminRole } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();

  const result = await syncAllRegisteredJobSources({
    concurrency: 8,
    staleAfterMinutes: 10,
    limit: 400,
    requestedBy: adminRole?.user_id ?? SYSTEM_INSPECTION_REQUESTER,
  });

  console.log(JSON.stringify({
    syncedAt: new Date().toISOString(),
    inspectionRequester: adminRole?.user_id ? "admin" : "system",
    ...result,
  }, null, 2));

  if (result.successful === 0 && result.failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
