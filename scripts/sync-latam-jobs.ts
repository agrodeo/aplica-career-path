import { supabaseAdmin } from "../src/integrations/supabase/client.server";
import { syncJobSource } from "../src/lib/job-sync.server";
import type { AtsProvider } from "../src/lib/job-sources/types";

const SYSTEM_INSPECTION_REQUESTER = "00000000-0000-0000-0000-000000000001";
const LATAM_COUNTRIES = [
  "ar","bo","br","cl","co","cr","do","ec","gt","hn","mx","ni","pa","pe","pr","py","sv","uy","ve",
];
const SUPPORTED_PROVIDERS = new Set<AtsProvider>([
  "greenhouse","smartrecruiters","workday","lever","ashby","workable","custom",
]);
const PAGE_SIZE = 1000;
const MAX_COMPANIES_PER_RUN = 160;
const STALE_AFTER_MINUTES = 10;

async function collectCompanyIds(builder: (from: number, to: number) => PromiseLike<any>) {
  const ids = new Set<string>();
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await builder(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    for (const row of page) if (row.company_id) ids.add(row.company_id);
    if (page.length < PAGE_SIZE) break;
  }
  return ids;
}

async function main() {
  const [countryIds, regionalLocationIds] = await Promise.all([
    collectCompanyIds((from, to) =>
      supabaseAdmin
        .from("jobs")
        .select("company_id")
        .eq("is_active", true)
        .in("country", LATAM_COUNTRIES)
        .range(from, to),
    ),
    collectCompanyIds((from, to) =>
      supabaseAdmin
        .from("jobs")
        .select("company_id")
        .eq("is_active", true)
        .or("location.ilike.%LATAM%,location.ilike.%Latin America%,location.ilike.%South America%")
        .range(from, to),
    ),
  ]);

  const priorityCompanyIds = new Set([...countryIds, ...regionalLocationIds]);
  const cutoff = Date.now() - STALE_AFTER_MINUTES * 60_000;

  const { data: companies, error } = await supabaseAdmin
    .from("companies")
    .select("id,name,careers_url,ats_type,ats_identifier,last_scanned_at,created_at")
    .eq("active", true)
    .not("ats_identifier", "is", null)
    .order("last_scanned_at", { ascending: true, nullsFirst: true })
    .limit(1000);

  if (error) throw new Error(error.message);

  const queue = (companies ?? [])
    .filter((company) => {
      if (!company.ats_identifier || !SUPPORTED_PROVIDERS.has(company.ats_type as AtsProvider)) return false;
      if (company.last_scanned_at == null) return true;
      if (!priorityCompanyIds.has(company.id)) return false;
      const scannedAt = new Date(company.last_scanned_at).getTime();
      return !Number.isFinite(scannedAt) || scannedAt < cutoff;
    })
    .slice(0, MAX_COMPANIES_PER_RUN);

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

  await Promise.all(Array.from({ length: Math.min(4, queue.length || 1) }, () => runner()));

  const summary = {
    syncedAt: new Date().toISOString(),
    knownLatamCompanies: priorityCompanyIds.size,
    queuedCompanies: queue.length,
    successful: results.filter((row) => row.ok).length,
    failed: results.filter((row) => !row.ok).length,
    discovered: results.reduce((sum, row) => sum + (typeof row.discovered === "number" ? row.discovered : 0), 0),
    inspectionsQueued: results.reduce((sum, row) => sum + (typeof row.inspectionsQueued === "number" ? row.inspectionsQueued : 0), 0),
    results,
  };

  console.log(JSON.stringify(summary, null, 2));
  if (summary.successful === 0 && summary.failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
