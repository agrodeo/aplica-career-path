import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  getJobSourceProvider,
  supportedAtsProviders,
} from "@/lib/job-sources/registry";
import type { AtsProvider } from "@/lib/job-sources/types";

export type JobSourceSyncInput = {
  provider: AtsProvider;
  identifier: string;
  companyName: string;
  careersUrl?: string | null;
  requestedBy?: string | null;
};

export type GreenhouseSyncInput = {
  boardToken: string;
  companyName: string;
  careersUrl?: string | null;
  requestedBy?: string | null;
};

export async function syncJobSource(input: JobSourceSyncInput) {
  const provider = getJobSourceProvider(input.provider);
  const identifier = input.identifier.trim();
  if (!identifier) throw new Error("Identificador de ATS vacío.");

  const discovery = await provider.fetchJobs(identifier);
  const now = new Date().toISOString();

  const { data: existingCompany } = await supabaseAdmin
    .from("companies")
    .select("id")
    .eq("ats_type", provider.type)
    .eq("ats_identifier", identifier)
    .maybeSingle();

  let companyId = existingCompany?.id ?? null;
  const autoApplySupported = Boolean(provider.submissionAdapter);

  if (!companyId) {
    const { data: company, error } = await supabaseAdmin
      .from("companies")
      .insert({
        name: input.companyName,
        careers_url: input.careersUrl ?? null,
        ats_type: provider.type,
        ats_identifier: identifier,
        auto_apply_supported: autoApplySupported,
        active: true,
        last_scanned_at: now,
      })
      .select("id")
      .single();

    if (error || !company) {
      throw new Error(error?.message ?? "No pudimos crear la empresa.");
    }
    companyId = company.id;
  } else {
    const { error } = await supabaseAdmin
      .from("companies")
      .update({
        name: input.companyName,
        careers_url: input.careersUrl ?? null,
        auto_apply_supported: autoApplySupported,
        active: true,
        last_scanned_at: now,
      })
      .eq("id", companyId);

    if (error) throw new Error(error.message);
  }

  const sourceName = `${provider.type}:${identifier}`;
  const { data: source, error: sourceError } = await supabaseAdmin
    .from("job_sources")
    .upsert(
      {
        name: sourceName,
        type: provider.sourceType,
        base_url: discovery.endpoint,
        adapter_name:
          provider.submissionAdapter ?? provider.discoveryAdapter,
        discovery_enabled: true,
        submission_enabled: autoApplySupported,
        requires_credentials: false,
        connection_status: "connected",
        active: true,
      },
      { onConflict: "name" },
    )
    .select("id")
    .single();

  if (sourceError || !source) {
    throw new Error(sourceError?.message ?? "No pudimos crear la fuente.");
  }

  const rows = discovery.jobs.map((job) => ({
    external_job_id: job.externalId,
    source_id: source.id,
    company_id: companyId!,
    title: job.title,
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
    ats_type: provider.type,
    auto_apply_adapter: provider.submissionAdapter,
    submission_mechanism: autoApplySupported ? "public_form" : "manual",
    published_at: job.publishedAt,
    is_active: true,
    raw_data: JSON.parse(
      JSON.stringify({
        ...job.rawData,
        provider: provider.type,
        identifier,
        synced_at: now,
      }),
    ),
    ...(autoApplySupported
      ? {}
      : {
          auto_apply_eligible: false,
          ineligibility_reason: "MANUAL_APPLY_ONLY",
          application_schema_id: null,
        }),
  }));

  if (rows.length) {
    const { error } = await supabaseAdmin
      .from("jobs")
      .upsert(rows, { onConflict: "source_id,external_job_id" });
    if (error) throw new Error(error.message);
  }

  const { data: currentJobs, error: currentError } = await supabaseAdmin
    .from("jobs")
    .select("id, external_job_id, application_url, last_verified_at")
    .eq("source_id", source.id);

  if (currentError) throw new Error(currentError.message);

  const discoveredIds = new Set(discovery.jobs.map((job) => job.externalId));
  const staleIds = (currentJobs ?? [])
    .filter((job) => !discoveredIds.has(job.external_job_id))
    .map((job) => job.id);

  for (let index = 0; index < staleIds.length; index += 100) {
    const { error } = await supabaseAdmin
      .from("jobs")
      .update({
        is_active: false,
        auto_apply_eligible: false,
        ineligibility_reason: "NOT_IN_LATEST_BOARD_SCAN",
      })
      .in("id", staleIds.slice(index, index + 100));
    if (error) throw new Error(error.message);
  }

  const inspectionCandidates = autoApplySupported
    ? (currentJobs ?? [])
        .filter((job) => {
          if (!job.application_url) return false;
          if (!job.last_verified_at) return true;
          return (
            Date.now() - new Date(job.last_verified_at).getTime() >
            24 * 60 * 60 * 1000
          );
        })
        .slice(0, 250)
    : [];

  let inspectionsQueued = 0;

  if (input.requestedBy && inspectionCandidates.length) {
    const staleInspectionIds = inspectionCandidates.map((job) => job.id);
    for (let index = 0; index < staleInspectionIds.length; index += 100) {
      const { error } = await supabaseAdmin
        .from("jobs")
        .update({
          auto_apply_eligible: false,
          ineligibility_reason: "REVERIFYING_FORM",
        })
        .in("id", staleInspectionIds.slice(index, index + 100));
      if (error) throw new Error(error.message);
    }

    const urls = inspectionCandidates
      .map((job) => job.application_url)
      .filter((url): url is string => Boolean(url));

    const { data: pending } = await supabaseAdmin
      .from("adapter_inspections")
      .select("url")
      .in("url", urls)
      .in("status", ["queued", "running"]);

    const pendingUrls = new Set((pending ?? []).map((row) => row.url));
    const toInspect = urls.filter((url) => !pendingUrls.has(url));

    if (toInspect.length) {
      const { error } = await supabaseAdmin.from("adapter_inspections").insert(
        toInspect.map((url) => ({
          requested_by: input.requestedBy!,
          url,
          mode: "inspect",
          status: "queued",
        })),
      );
      if (error) throw new Error(error.message);
      inspectionsQueued = toInspect.length;
    }
  }

  return {
    provider: provider.type,
    identifier,
    companyId,
    sourceId: source.id,
    discovered: discovery.jobs.length,
    deactivated: staleIds.length,
    inspectionsQueued,
    reportedTotal: discovery.reportedTotal ?? discovery.jobs.length,
    scannedAt: now,
  };
}

export async function syncGreenhouseSource(input: GreenhouseSyncInput) {
  const result = await syncJobSource({
    provider: "greenhouse",
    identifier: input.boardToken,
    companyName: input.companyName,
    careersUrl: input.careersUrl,
    requestedBy: input.requestedBy,
  });

  return {
    ...result,
    greenhouseReportedTotal: result.reportedTotal,
  };
}

export async function syncAllRegisteredJobSources(options?: {
  requestedBy?: string | null;
  concurrency?: number;
  providers?: AtsProvider[];
}) {
  const providers = options?.providers?.length
    ? options.providers
    : supportedAtsProviders;

  const { data: companies, error } = await supabaseAdmin
    .from("companies")
    .select("id,name,careers_url,ats_type,ats_identifier,last_scanned_at")
    .eq("active", true)
    .in("ats_type", providers)
    .not("ats_identifier", "is", null)
    .order("last_scanned_at", { ascending: true, nullsFirst: true });

  if (error) throw new Error(error.message);

  const queue = (companies ?? []).filter(
    (
      company,
    ): company is typeof company & {
      ats_type: AtsProvider;
      ats_identifier: string;
    } =>
      Boolean(company.ats_identifier) &&
      providers.includes(company.ats_type as AtsProvider),
  );

  const concurrency = Math.max(1, Math.min(options?.concurrency ?? 4, 8));
  const results: Array<{
    companyId: string;
    companyName: string;
    provider: AtsProvider;
    identifier: string;
    ok: boolean;
    discovered?: number;
    deactivated?: number;
    inspectionsQueued?: number;
    error?: string;
  }> = [];

  let cursor = 0;

  async function runner() {
    while (true) {
      const index = cursor++;
      const company = queue[index];
      if (!company) return;

      try {
        const result = await syncJobSource({
          provider: company.ats_type,
          identifier: company.ats_identifier,
          companyName: company.name,
          careersUrl: company.careers_url,
          requestedBy: options?.requestedBy ?? null,
        });
        results.push({
          companyId: company.id,
          companyName: company.name,
          provider: company.ats_type,
          identifier: company.ats_identifier,
          ok: true,
          discovered: result.discovered,
          deactivated: result.deactivated,
          inspectionsQueued: result.inspectionsQueued,
        });
      } catch (error) {
        results.push({
          companyId: company.id,
          companyName: company.name,
          provider: company.ats_type,
          identifier: company.ats_identifier,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length || 1) }, () =>
      runner(),
    ),
  );

  return {
    scanned: queue.length,
    successful: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
    discovered: results.reduce(
      (total, result) => total + (result.discovered ?? 0),
      0,
    ),
    deactivated: results.reduce(
      (total, result) => total + (result.deactivated ?? 0),
      0,
    ),
    inspectionsQueued: results.reduce(
      (total, result) => total + (result.inspectionsQueued ?? 0),
      0,
    ),
    results,
  };
}

export function syncAllRegisteredGreenhouseSources(options?: {
  requestedBy?: string | null;
  concurrency?: number;
}) {
  return syncAllRegisteredJobSources({
    ...options,
    providers: ["greenhouse"],
  });
}

let refreshPromise: Promise<
  Awaited<ReturnType<typeof syncAllRegisteredJobSources>>
> | null = null;

/**
 * Self-healing freshness guard used by authenticated inventory reads.
 * The cron route is the normal path; this prevents stale jobs if the scheduler
 * is delayed or temporarily unavailable.
 */
export async function ensureInventoryFresh(maxAgeMinutes = 20) {
  const cutoff = Date.now() - maxAgeMinutes * 60_000;
  const { data: companies, error } = await supabaseAdmin
    .from("companies")
    .select("last_scanned_at,ats_type")
    .eq("active", true)
    .in("ats_type", supportedAtsProviders)
    .not("ats_identifier", "is", null);

  if (error) throw new Error(error.message);
  if (!companies?.length) return null;

  const stale = companies.some((company) => {
    if (!company.last_scanned_at) return true;
    const timestamp = new Date(company.last_scanned_at).getTime();
    return !Number.isFinite(timestamp) || timestamp < cutoff;
  });

  if (!stale) return null;

  if (!refreshPromise) {
    refreshPromise = (async () => {
      const { data: adminRole } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin")
        .limit(1)
        .maybeSingle();

      return syncAllRegisteredJobSources({
        requestedBy: adminRole?.user_id ?? null,
        concurrency: 4,
      });
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}
