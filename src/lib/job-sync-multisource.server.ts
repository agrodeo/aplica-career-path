import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { syncGreenhouseSource } from "@/lib/job-sync.server";
import { syncLeverSource } from "@/lib/job-sources/lever";
import { syncAshbySource } from "@/lib/job-sources/ashby";
import { syncSmartRecruitersSource } from "@/lib/job-sources/smartrecruiters";
import { syncWorkableSource } from "@/lib/job-sources/workable";
import { syncWorkdaySource } from "@/lib/job-sources/workday";

type CompanySource = {
  id: string;
  name: string;
  careers_url: string | null;
  ats_type: string | null;
  ats_identifier: string | null;
};

export async function syncRegisteredSource(company: CompanySource, requestedBy?: string | null) {
  if (!company.ats_type || !company.ats_identifier) throw new Error("Fuente sin ATS configurado.");

  if (company.ats_type === "greenhouse") {
    return syncGreenhouseSource({
      boardToken: company.ats_identifier,
      companyName: company.name,
      careersUrl: company.careers_url,
      requestedBy: requestedBy ?? null,
    });
  }
  if (company.ats_type === "lever") {
    return syncLeverSource({
      site: company.ats_identifier,
      companyName: company.name,
      careersUrl: company.careers_url,
      eu: /jobs\.eu\.lever\.co|api\.eu\.lever\.co/i.test(company.careers_url ?? ""),
    });
  }
  if (company.ats_type === "ashby") {
    return syncAshbySource({
      boardName: company.ats_identifier,
      companyName: company.name,
      careersUrl: company.careers_url,
    });
  }
  if (company.ats_type === "smartrecruiters") {
    return syncSmartRecruitersSource({
      companyIdentifier: company.ats_identifier,
      companyName: company.name,
      careersUrl: company.careers_url,
    });
  }
  if (company.ats_type === "workable") {
    return syncWorkableSource({
      account: company.ats_identifier,
      companyName: company.name,
      careersUrl: company.careers_url,
    });
  }
  if (company.ats_type === "workday") {
    const [host, site] = company.ats_identifier.split("|");
    const tenant = host?.split(".")[0] ?? "";
    if (!host || !site || !tenant) throw new Error("Identificador de Workday inválido.");
    return syncWorkdaySource({
      host,
      tenant,
      site,
      companyName: company.name,
      careersUrl: company.careers_url,
    });
  }
  throw new Error(`ATS discovery todavía no soportado: ${company.ats_type}`);
}

export async function syncAllRegisteredSources(options?: { requestedBy?: string | null; concurrency?: number }) {
  const { data: companies, error } = await supabaseAdmin
    .from("companies")
    .select("id,name,careers_url,ats_type,ats_identifier,last_scanned_at")
    .eq("active", true)
    .not("ats_identifier", "is", null)
    .in("ats_type", ["greenhouse", "lever", "ashby", "smartrecruiters", "workable", "workday"])
    .order("last_scanned_at", { ascending: true, nullsFirst: true });

  if (error) throw new Error(error.message);
  const queue = (companies ?? []).filter((company): company is typeof company & { ats_identifier: string } => Boolean(company.ats_identifier));
  const concurrency = Math.max(1, Math.min(options?.concurrency ?? 4, 8));
  const results: Array<Record<string, unknown> & { ok: boolean }> = [];
  let cursor = 0;

  async function runner() {
    while (true) {
      const company = queue[cursor++];
      if (!company) return;
      try {
        const result = await syncRegisteredSource(company, options?.requestedBy);
        results.push({ companyId: company.id, companyName: company.name, atsType: company.ats_type, identifier: company.ats_identifier, ok: true, ...result });
      } catch (error) {
        results.push({ companyId: company.id, companyName: company.name, atsType: company.ats_type, identifier: company.ats_identifier, ok: false, error: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length || 1) }, () => runner()));
  return {
    scanned: queue.length,
    successful: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
    discovered: results.reduce((sum, result) => sum + Number(result.discovered ?? 0), 0),
    deactivated: results.reduce((sum, result) => sum + Number(result.deactivated ?? 0), 0),
    inspectionsQueued: results.reduce((sum, result) => sum + Number(result.inspectionsQueued ?? 0), 0),
    results,
  };
}
