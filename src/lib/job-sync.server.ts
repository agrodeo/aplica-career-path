import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type GreenhouseSyncInput = {
  boardToken: string;
  companyName: string;
  careersUrl?: string | null;
  requestedBy?: string | null;
};

type GreenhouseJob = {
  id: number;
  internal_job_id?: number | null;
  title: string;
  updated_at?: string;
  location?: { name?: string | null } | null;
  absolute_url?: string | null;
  content?: string | null;
  language?: string | null;
  metadata?: unknown;
  departments?: Array<{ id?: number; name?: string; parent_id?: number | null }>;
  offices?: Array<{ id?: number; name?: string; location?: string | null }>;
};

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

function toPlainText(value: string | null | undefined) {
  let decoded = value ?? "";
  for (let i = 0; i < 2; i += 1) decoded = decodeEntities(decoded);
  return decoded
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferRemoteType(job: GreenhouseJob) {
  const text =
    `${job.title} ${job.location?.name ?? ""} ${toPlainText(job.content).slice(0, 1500)}`.toLowerCase();
  if (/\bremote\b|\bremoto\b|work from home/.test(text)) return "remote";
  if (/\bhybrid\b|\bhíbrido\b|\bhibrido\b/.test(text)) return "hybrid";
  if (/\bon[- ]?site\b|\bpresencial\b/.test(text)) return "onsite";
  return null;
}

function inferEmploymentType(title: string, description: string) {
  const text = `${title} ${description.slice(0, 1200)}`.toLowerCase();
  if (/\bintern(ship)?\b|\bpasant/.test(text)) return "internship";
  if (/\bpart[- ]?time\b/.test(text)) return "part-time";
  if (/\bcontract(or)?\b|\bfreelance\b/.test(text)) return "contract";
  return "full-time";
}

function inferSeniority(title: string) {
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

function canonicalApplicationUrl(boardToken: string, jobId: number) {
  return `https://job-boards.greenhouse.io/${encodeURIComponent(boardToken)}/jobs/${jobId}`;
}

export async function syncGreenhouseSource(input: GreenhouseSyncInput) {
  const endpoint = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(input.boardToken)}/jobs?content=true`;
  const response = await fetch(endpoint, {
    headers: {
      accept: "application/json",
      "user-agent": "AplicaJobDiscovery/2.0 (+https://aplica.lat)",
    },
    signal: AbortSignal.timeout(25_000),
  });

  if (!response.ok) {
    throw new Error(
      `Greenhouse ${input.boardToken} respondió ${response.status}.`,
    );
  }

  const payload = (await response.json()) as {
    jobs?: GreenhouseJob[];
    meta?: { total?: number };
  };
  const jobs = Array.isArray(payload.jobs) ? payload.jobs : [];
  const now = new Date().toISOString();

  const { data: existingCompany } = await supabaseAdmin
    .from("companies")
    .select("id")
    .eq("ats_type", "greenhouse")
    .eq("ats_identifier", input.boardToken)
    .maybeSingle();

  let companyId = existingCompany?.id ?? null;

  if (!companyId) {
    const { data: company, error } = await supabaseAdmin
      .from("companies")
      .insert({
        name: input.companyName,
        careers_url: input.careersUrl ?? null,
        ats_type: "greenhouse",
        ats_identifier: input.boardToken,
        auto_apply_supported: true,
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
        auto_apply_supported: true,
        active: true,
        last_scanned_at: now,
      })
      .eq("id", companyId);

    if (error) throw new Error(error.message);
  }

  const sourceName = `greenhouse:${input.boardToken}`;
  const { data: source, error: sourceError } = await supabaseAdmin
    .from("job_sources")
    .upsert(
      {
        name: sourceName,
        type: "greenhouse_job_board",
        base_url: endpoint,
        adapter_name: "greenhouse_public_form",
        discovery_enabled: true,
        submission_enabled: true,
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

  const rows = jobs.map((job) => {
    const description = toPlainText(job.content);
    return {
      external_job_id: String(job.id),
      source_id: source.id,
      company_id: companyId!,
      title: job.title.trim().slice(0, 500),
      description,
      location: job.location?.name?.trim() || null,
      country:
        job.offices?.find((office) => office.location)?.location ?? null,
      remote_type: inferRemoteType(job),
      employment_type: inferEmploymentType(job.title, description),
      seniority: inferSeniority(job.title),
      application_url: canonicalApplicationUrl(input.boardToken, job.id),
      ats_type: "greenhouse",
      auto_apply_adapter: "greenhouse_public_form",
      is_active: true,
      raw_data: {
        board_token: input.boardToken,
        internal_job_id: job.internal_job_id ?? null,
        absolute_url: job.absolute_url ?? null,
        updated_at: job.updated_at ?? null,
        language: job.language ?? null,
        metadata: job.metadata ?? null,
        departments: job.departments ?? [],
        offices: job.offices ?? [],
        synced_at: now,
      },
    };
  });

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

  const discoveredIds = new Set(jobs.map((job) => String(job.id)));
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

  const inspectionCandidates = (currentJobs ?? [])
    .filter((job) => {
      if (!job.application_url) return false;
      if (!job.last_verified_at) return true;
      return (
        Date.now() - new Date(job.last_verified_at).getTime() >
        24 * 60 * 60 * 1000
      );
    })
    .slice(0, 250);

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
    companyId,
    sourceId: source.id,
    discovered: jobs.length,
    deactivated: staleIds.length,
    inspectionsQueued,
    greenhouseReportedTotal: payload.meta?.total ?? jobs.length,
    scannedAt: now,
  };
}

export async function syncAllRegisteredGreenhouseSources(options?: {
  requestedBy?: string | null;
  concurrency?: number;
}) {
  const { data: companies, error } = await supabaseAdmin
    .from("companies")
    .select("id,name,careers_url,ats_identifier,last_scanned_at")
    .eq("active", true)
    .eq("ats_type", "greenhouse")
    .not("ats_identifier", "is", null)
    .order("last_scanned_at", { ascending: true, nullsFirst: true });

  if (error) throw new Error(error.message);

  const queue = (companies ?? []).filter(
    (
      company,
    ): company is typeof company & { ats_identifier: string } =>
      Boolean(company.ats_identifier),
  );

  const concurrency = Math.max(1, Math.min(options?.concurrency ?? 3, 6));
  const results: Array<{
    companyId: string;
    companyName: string;
    boardToken: string;
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
        const result = await syncGreenhouseSource({
          boardToken: company.ats_identifier,
          companyName: company.name,
          careersUrl: company.careers_url,
          requestedBy: options?.requestedBy ?? null,
        });
        results.push({
          companyId: company.id,
          companyName: company.name,
          boardToken: company.ats_identifier,
          ok: true,
          discovered: result.discovered,
          deactivated: result.deactivated,
          inspectionsQueued: result.inspectionsQueued,
        });
      } catch (error) {
        results.push({
          companyId: company.id,
          companyName: company.name,
          boardToken: company.ats_identifier,
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


let refreshPromise: Promise<unknown> | null = null;

/**
 * Self-healing freshness guard used by authenticated inventory reads.
 * The cron route is the normal path; this prevents stale jobs if the scheduler
 * is delayed or temporarily unavailable.
 */
export async function ensureInventoryFresh(maxAgeMinutes = 20) {
  const cutoff = Date.now() - maxAgeMinutes * 60_000;
  const { data: companies, error } = await supabaseAdmin
    .from("companies")
    .select("last_scanned_at")
    .eq("active", true)
    .eq("ats_type", "greenhouse")
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

      return syncAllRegisteredGreenhouseSources({
        requestedBy: adminRole?.user_id ?? null,
        concurrency: 3,
      });
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}
