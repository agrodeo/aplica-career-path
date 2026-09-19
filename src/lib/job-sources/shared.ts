import { supabaseAdmin } from "@/integrations/supabase/client.server";

export function toPlainText(value: string | null | undefined) {
  return (value ?? "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<li[^>]*>/gi, " • ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export type NormalizedJob = {
  externalJobId: string;
  title: string;
  description: string;
  location: string | null;
  country: string | null;
  remoteType: string | null;
  employmentType: string | null;
  seniority: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  applicationUrl: string;
  publishedAt: string | null;
  rawData: Record<string, unknown>;
};

export type SourceSyncDefinition = {
  atsType: string;
  sourceType: string;
  adapterName: string;
  submissionEnabled: boolean;
  autoApplySupported: boolean;
  baseUrl: string;
};

export function inferSeniority(title: string) {
  const value = title.toLowerCase();
  if (/\bchief\b|\bc[tef]o\b|\bvp\b|vice president/.test(value)) return "executive";
  if (/\bdirector\b|\bhead of\b/.test(value)) return "director";
  if (/\bmanager\b/.test(value)) return "manager";
  if (/\bstaff\b|\bprincipal\b/.test(value)) return "staff";
  if (/\blead\b/.test(value)) return "lead";
  if (/\bsenior\b|\bsr\.?\b/.test(value)) return "senior";
  if (/\bjunior\b|\bjr\.?\b|\bentry\b/.test(value)) return "junior";
  if (/\bintern\b|\bpasant/.test(value)) return "intern";
  return null;
}

export function normalizeEmploymentType(value: string | null | undefined) {
  const text = (value ?? "").toLowerCase().replace(/[_-]+/g, " ");
  if (/intern|pasant/.test(text)) return "internship";
  if (/part\s*time/.test(text)) return "part-time";
  if (/contract|freelance/.test(text)) return "contract";
  if (/temporary|temp\b/.test(text)) return "temporary";
  if (/full\s*time/.test(text)) return "full-time";
  return value ? value.toLowerCase() : null;
}

export function normalizeRemoteType(value: string | null | undefined, fallbackText = "") {
  const text = `${value ?? ""} ${fallbackText}`.toLowerCase();
  if (/\bremote\b|\bremoto\b|work from home/.test(text)) return "remote";
  if (/\bhybrid\b|\bhíbrido\b|\bhibrido\b/.test(text)) return "hybrid";
  if (/on[- ]?site|presencial/.test(text)) return "onsite";
  return null;
}

export async function upsertSourceInventory(input: {
  identifier: string;
  companyName: string;
  careersUrl?: string | null;
  definition: SourceSyncDefinition;
  jobs: NormalizedJob[];
}) {
  const now = new Date().toISOString();
  const { definition } = input;

  const { data: existingCompany } = await supabaseAdmin
    .from("companies")
    .select("id")
    .eq("ats_type", definition.atsType)
    .eq("ats_identifier", input.identifier)
    .maybeSingle();

  let companyId = existingCompany?.id ?? null;

  if (!companyId) {
    const { data: company, error } = await supabaseAdmin
      .from("companies")
      .insert({
        name: input.companyName,
        careers_url: input.careersUrl ?? null,
        ats_type: definition.atsType,
        ats_identifier: input.identifier,
        auto_apply_supported: definition.autoApplySupported,
        active: true,
        last_scanned_at: now,
      })
      .select("id")
      .single();
    if (error || !company) throw new Error(error?.message ?? "No pudimos crear la empresa.");
    companyId = company.id;
  } else {
    const { error } = await supabaseAdmin
      .from("companies")
      .update({
        name: input.companyName,
        careers_url: input.careersUrl ?? null,
        auto_apply_supported: definition.autoApplySupported,
        active: true,
        last_scanned_at: now,
      })
      .eq("id", companyId);
    if (error) throw new Error(error.message);
  }

  const sourceName = `${definition.atsType}:${input.identifier}`;
  const { data: source, error: sourceError } = await supabaseAdmin
    .from("job_sources")
    .upsert({
      name: sourceName,
      type: definition.sourceType,
      base_url: definition.baseUrl,
      adapter_name: definition.adapterName,
      discovery_enabled: true,
      submission_enabled: definition.submissionEnabled,
      requires_credentials: false,
      connection_status: "connected",
      active: true,
    }, { onConflict: "name" })
    .select("id")
    .single();

  if (sourceError || !source) throw new Error(sourceError?.message ?? "No pudimos crear la fuente.");

  const rows = input.jobs.map((job) => ({
    external_job_id: job.externalJobId,
    source_id: source.id,
    company_id: companyId!,
    title: job.title.slice(0, 500),
    description: job.description,
    location: job.location,
    country: job.country,
    remote_type: job.remoteType,
    employment_type: job.employmentType,
    seniority: job.seniority,
    salary_min: job.salaryMin,
    salary_max: job.salaryMax,
    salary_currency: job.salaryCurrency,
    application_url: job.applicationUrl,
    ats_type: definition.atsType,
    auto_apply_adapter: definition.submissionEnabled ? definition.adapterName : null,
    auto_apply_eligible: false,
    published_at: job.publishedAt,
    is_active: true,
    raw_data: { ...job.rawData, synced_at: now },
  }));

  if (rows.length) {
    const { error } = await supabaseAdmin.from("jobs").upsert(rows, { onConflict: "source_id,external_job_id" });
    if (error) throw new Error(error.message);
  }

  const { data: currentJobs, error: currentError } = await supabaseAdmin
    .from("jobs")
    .select("id,external_job_id")
    .eq("source_id", source.id);
  if (currentError) throw new Error(currentError.message);

  const discoveredIds = new Set(input.jobs.map((job) => job.externalJobId));
  const staleIds = (currentJobs ?? []).filter((job) => !discoveredIds.has(job.external_job_id)).map((job) => job.id);

  for (let index = 0; index < staleIds.length; index += 100) {
    const { error } = await supabaseAdmin
      .from("jobs")
      .update({ is_active: false, auto_apply_eligible: false, ineligibility_reason: "NOT_IN_LATEST_BOARD_SCAN" })
      .in("id", staleIds.slice(index, index + 100));
    if (error) throw new Error(error.message);
  }

  return { companyId, sourceId: source.id, discovered: input.jobs.length, deactivated: staleIds.length, scannedAt: now };
}
