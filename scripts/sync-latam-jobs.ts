import { supabaseAdmin } from "../src/integrations/supabase/client.server";
import { syncJobSource } from "../src/lib/job-sync.server";
import type { AtsProvider } from "../src/lib/job-sources/types";

const SYSTEM_INSPECTION_REQUESTER = "00000000-0000-0000-0000-000000000001";
const ALL_PROVIDERS: AtsProvider[] = [
  "greenhouse",
  "smartrecruiters",
  "workday",
  "lever",
  "ashby",
  "workable",
  "custom",
];
const SUPPORTED_PROVIDERS = new Set<AtsProvider>(ALL_PROVIDERS);

function requestedProviders(): AtsProvider[] {
  const raw = process.env.SYNC_PROVIDERS?.trim();
  if (!raw) return ALL_PROVIDERS;
  const providers = raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value): value is AtsProvider => SUPPORTED_PROVIDERS.has(value as AtsProvider));
  return providers.length ? providers : ALL_PROVIDERS;
}
const MAX_COMPANIES_PER_RUN = 60;
const STALE_AFTER_MINUTES = 30;

async function main() {
  const cutoff = Date.now() - STALE_AFTER_MINUTES * 60_000;
  const providers = requestedProviders();
  const companyLimit =
    providers.length === 1 && providers[0] === "smartrecruiters" ? 20 : MAX_COMPANIES_PER_RUN;

  const { data: companies, error } = await (supabaseAdmin.from("companies") as any)
    .select("id,name,careers_url,ats_type,ats_identifier,last_scanned_at,latam_priority")
    .eq("active", true)
    .in("ats_type", providers)
    .not("ats_identifier", "is", null)
    // Unscanned worldwide boards have their own inventory lane. Mixing them
    // here let null scan dates crowd actual LATAM employers out of the limit.
    .eq("latam_priority", true)
    .or(`last_scanned_at.is.null,last_scanned_at.lt.${new Date(cutoff).toISOString()}`)
    .order("last_scanned_at", { ascending: true, nullsFirst: true })
    .limit(companyLimit);

  if (error) throw new Error(error.message);

  const uniqueCompanies = [
    ...new Map(
      (companies ?? []).map((company) => [
        `${company.ats_type}:${company.ats_identifier?.trim()}`,
        company,
      ]),
    ).values(),
  ];
  const queue = uniqueCompanies
    .filter((company) => {
      if (!company.ats_identifier || !SUPPORTED_PROVIDERS.has(company.ats_type as AtsProvider))
        return false;
      if (company.last_scanned_at == null) return true;
      if (!company.latam_priority) return false;
      const scannedAt = new Date(company.last_scanned_at).getTime();
      return !Number.isFinite(scannedAt) || scannedAt < cutoff;
    })
    .slice(0, companyLimit);

  const { data: adminRole } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();

  const requestedBy = adminRole?.user_id ?? SYSTEM_INSPECTION_REQUESTER;
  const results: Array<Record<string, unknown>> = [];
  let cursor = 0;

  async function runner() {
    while (true) {
      const company = queue[cursor++];
      if (!company) return;
      try {
        const result = await syncJobSource({
          provider: company.ats_type as AtsProvider,
          identifier: company.ats_identifier!,
          companyName: company.name,
          careersUrl: company.careers_url,
          requestedBy,
        });
        results.push({
          company: company.name,
          provider: company.ats_type,
          ok: true,
          discovered: result.discovered,
          inspectionsQueued: result.inspectionsQueued,
        });
      } catch (error) {
        results.push({
          company: company.name,
          provider: company.ats_type,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  const concurrency = providers.length === 1 && providers[0] === "custom" ? 1
    : 2;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length || 1) }, () => runner()),
  );

  const summary = {
    syncedAt: new Date().toISOString(),
    providers,
    knownLatamCompanies: (companies ?? []).filter((company: any) => company.latam_priority).length,
    queuedCompanies: queue.length,
    successful: results.filter((row) => row.ok).length,
    failed: results.filter((row) => !row.ok).length,
    discovered: results.reduce(
      (sum, row) => sum + (typeof row.discovered === "number" ? row.discovered : 0),
      0,
    ),
    inspectionsQueued: results.reduce(
      (sum, row) => sum + (typeof row.inspectionsQueued === "number" ? row.inspectionsQueued : 0),
      0,
    ),
    results,
  };

  console.log(JSON.stringify(summary, null, 2));
  if (summary.successful === 0 && summary.failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
