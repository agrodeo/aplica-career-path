import { supabaseAdmin } from "../src/integrations/supabase/client.server";
import { syncAllRegisteredJobSources } from "../src/lib/job-sync.server";
import type { AtsProvider } from "../src/lib/job-sources/types";

const SYSTEM_INSPECTION_REQUESTER = "00000000-0000-0000-0000-000000000001";
const ALL_PROVIDERS: AtsProvider[] = [
  "greenhouse",
  "smartrecruiters",
  "workday",
  "lever",
  "ashby",
  "workable",
];

function requestedProviders(): AtsProvider[] | undefined {
  const raw = process.env.SYNC_PROVIDERS?.trim();
  if (!raw) return undefined;

  const requested = raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value): value is AtsProvider =>
      ALL_PROVIDERS.includes(value as AtsProvider),
    );

  return requested.length ? requested : undefined;
}

// worldwide inventory wave 17 + Argentina/LATAM expansion
async function main() {
  const { data: adminRole } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();

  const providers = requestedProviders();
  const result = await syncAllRegisteredJobSources({
    concurrency: 8,
    staleAfterMinutes: 10,
    limit: 400,
    providers,
    requestedBy: adminRole?.user_id ?? SYSTEM_INSPECTION_REQUESTER,
  });

  console.log(JSON.stringify({
    syncedAt: new Date().toISOString(),
    inspectionRequester: adminRole?.user_id ? "admin" : "system",
    providers: providers ?? "all",
    ...result,
  }, null, 2));

  if (result.successful === 0 && result.failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
