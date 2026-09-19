import { supabaseAdmin } from "@/integrations/supabase/client.server";

type GreenhouseJob = {
  id: number;
  internal_job_id?: number | null;
  title: string;
  updated_at?: string | null;
  location?: { name?: string | null } | null;
  absolute_url?: string | null;
  content?: string | null;
  language?: string | null;
  metadata?: unknown;
  departments?: Array<{
    id?: number;
    name?: string;
    parent_id?: number | null;
  }>;
  offices?: Array<{
    id?: number;
    name?: string;
    location?: string | null;
  }>;
};

export type GreenhouseSyncTarget = {
  boardToken: string;
  companyName: string;
  careersUrl?: string | null;
  companyId?: string | null;
  requestedBy?: string | null;
};

export type GreenhouseSyncResult = {
  companyId: string;
  sourceId: string;
  discovered: number;
  deactivated: number;
  inspectionsQueued: number;
  greenhouseReportedTotal: number;
  syncedAt: string;
};

const INSPECTION_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_INSPECTIONS_PER_SYNC = 150;

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
  const text = `${job.title} ${job.location?.name ?? ""} ${toPlainText(
    job.content,
  ).slice(0, 1500)}`.toLowerCase();
  if (/\bremote\b|\bremoto\b|work from home/.test(text)) return "remote";
  if (/\bhybrid\b|\bhíbrido\b|\bhibrido\b/.test(text)) return "hybrid";
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
  if (/\bchief\b|\bc[tef]o\b|\bvp\b|vice president/.test(value)) {
    return "executive";
  }
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
  return `https://job-boards.greenhouse.io/${encodeURIComponent(
    boardToken,
  )}/jobs/${jobId}`;
}

function normalizeTimestamp(value: string | null | undefined) {
  if (!value) return null;
  const timestamp = new Date(value);
  return Number.isFinite(timestamp.getTime()) ? timestamp.toISOString() : null;
}

function rawUpdatedAt(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = (raw as Record<string, unknown>)["updated_at"];
  return typeof value === "string" ? normalizeTimestamp(value) : null;
}

async function markSourceFailure(sourceId: string | null, message: string) {
  if (!sourceId) return;
  await supabaseAdmin
    .from("job_sources")
    .update({
      last_synced_at: new Date().toISOString(),
      last_sync_status: "failed",
      last_sync_error: message.slice(0, 1000),
      connection_status: "error",
    })
    .eq("id", sourceId);
}

export async function syncGreenhouseTarget(
  target: GreenhouseSyncTarget,
): Promise<GreenhouseSyncResult> {
  const boardToken = target.boardToken.trim();
  const companyName = target.companyName.trim();
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(boardToken)) {
    throw new Error("Board token inválido.");
  }
  if (!companyName) throw new Error("Nombre de empresa vacío.");

  const sourceName = `greenhouse:${boardToken}`;
  const endpoint = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(
    boardToken,
  )}/jobs?content=true`;

  const { data: knownSource } = await supabaseAdmin
    .from("job_sources")
    .select("id")
    .eq("name", sourceName)
    .maybeSingle();

  let sourceId = knownSource?.id ?? null;

  try {
    const response = await fetch(endpoint, {
      headers: {
        accept: "application/json",
        "user-agent": "AplicaJobDiscovery/2.0",
      },
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      throw new Error(
        `Greenhouse respondió ${response.status} para ${boardToken}.`,
      );
    }

    const payload = (await response.json()) as {
      jobs?: GreenhouseJob[];
      meta?: { total?: number };
    };
    const jobs = Array.isArray(payload.jobs) ? payload.jobs : [];
    const syncedAt = new Date().toISOString();

    let companyId = target.companyId ?? null;
    if (!companyId) {
      const { data: existingCompany } = await supabaseAdmin
        .from("companies")
        .select("id")
        .eq("ats_type", "greenhouse")
        .eq("ats_identifier", boardToken)
        .maybeSingle();
      companyId = existingCompany?.id ?? null;
    }

    if (!companyId) {
      const { data: company, error } = await supabaseAdmin
        .from("companies")
        .insert({
          name: companyName,
          careers_url: target.careersUrl ?? null,
          ats_type: "greenhouse",
          ats_identifier: boardToken,
          auto_apply_supported: true,
          active: true,
          last_scanned_at: syncedAt,
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
          name: companyName,
          ...(target.careersUrl !== undefined
            ? { careers_url: target.careersUrl }
            : {}),
          auto_apply_supported: true,
          active: true,
          last_scanned_at: syncedAt,
        })
        .eq("id", companyId);
      if (error) throw new Error(error.message);
    }

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
          last_synced_at: syncedAt,
          last_sync_status: "running",
          last_sync_error: null,
        },
        { onConflict: "name" },
      )
      .select("id")
      .single();

    if (sourceError || !source) {
      throw new Error(sourceError?.message ?? "No pudimos guardar la fuente.");
    }
    sourceId = source.id;

    const { data: previousJobs, error: previousError } = await supabaseAdmin
      .from("jobs")
      .select(
        "id,external_job_id,application_url,last_verified_at,raw_data,source_updated_at",
      )
      .eq("source_id", sourceId);

    if (previousError) throw new Error(previousError.message);

    const previousByExternalId = new Map(
      (previousJobs ?? []).map((job) => [job.external_job_id, job]),
    );

    const rows = jobs.map((job) => {
      const description = toPlainText(job.content);
      return {
        external_job_id: String(job.id),
        source_id: sourceId!,
        company_id: companyId!,
        title: job.title.trim().slice(0, 500),
        description,
        location: job.location?.name?.trim() || null,
        country:
          job.offices?.find((office) => office.location)?.location ?? null,
        remote_type: inferRemoteType(job),
        employment_type: inferEmploymentType(job.title, description),
        seniority: inferSeniority(job.title),
        application_url: canonicalApplicationUrl(boardToken, job.id),
        ats_type: "greenhouse",
        auto_apply_adapter: "greenhouse_public_form",
        is_active: true,
        source_updated_at: normalizeTimestamp(job.updated_at),
        raw_data: {
          board_token: boardToken,
          internal_job_id: job.internal_job_id ?? null,
          absolute_url: job.absolute_url ?? null,
          updated_at: job.updated_at ?? null,
          language: job.language ?? null,
          metadata: job.metadata ?? null,
          departments: job.departments ?? [],
          offices: job.offices ?? [],
        },
      };
    });

    if (rows.length) {
      const { error } = await supabaseAdmin
        .from("jobs")
        .upsert(rows, { onConflict: "source_id,external_job_id" });
      if (error) throw new Error(error.message);
    }

    const discoveredIds = new Set(jobs.map((job) => String(job.id)));
    const staleIds = (previousJobs ?? [])
      .filter((job) => !discoveredIds.has(job.external_job_id))
      .map((job) => job.id);

    if (staleIds.length) {
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
    }

    const { data: currentJobs, error: currentError } = await supabaseAdmin
      .from("jobs")
      .select(
        "id,external_job_id,application_url,last_verified_at,source_updated_at",
      )
      .eq("source_id", sourceId)
      .eq("is_active", true);

    if (currentError) throw new Error(currentError.message);

    const now = Date.now();
    const candidates = (currentJobs ?? [])
      .filter((job) => {
        if (!job.application_url) return false;

        const previous = previousByExternalId.get(job.external_job_id);
        const previousUpdated =
          previous?.source_updated_at ?? rawUpdatedAt(previous?.raw_data);
        const sourceChanged =
          Boolean(job.source_updated_at) &&
          normalizeTimestamp(job.source_updated_at) !==
            normalizeTimestamp(previousUpdated);

        if (sourceChanged) return true;
        if (!job.last_verified_at) return true;

        return (
          now - new Date(job.last_verified_at).getTime() >
          INSPECTION_TTL_MS
        );
      })
      .sort((a, b) => {
        const left = a.last_verified_at
          ? new Date(a.last_verified_at).getTime()
          : 0;
        const right = b.last_verified_at
          ? new Date(b.last_verified_at).getTime()
          : 0;
        return left - right;
      })
      .slice(0, MAX_INSPECTIONS_PER_SYNC);

    const urls = candidates
      .map((job) => job.application_url)
      .filter((url): url is string => Boolean(url));

    const { data: pending } = urls.length
      ? await supabaseAdmin
          .from("adapter_inspections")
          .select("url")
          .in("url", urls)
          .in("status", ["queued", "running"])
      : { data: [] as Array<{ url: string }> };

    const pendingUrls = new Set((pending ?? []).map((row) => row.url));
    const toInspect = urls.filter((url) => !pendingUrls.has(url));

    if (toInspect.length) {
      const { error } = await supabaseAdmin
        .from("adapter_inspections")
        .insert(
          toInspect.map((url) => ({
            requested_by: target.requestedBy ?? null,
            url,
            mode: "inspect",
            status: "queued",
          })),
        );
      if (error) throw new Error(error.message);
    }

    await supabaseAdmin
      .from("job_sources")
      .update({
        last_synced_at: syncedAt,
        last_sync_status: "success",
        last_sync_error: null,
        last_job_count: jobs.length,
        connection_status: "connected",
      })
      .eq("id", sourceId);

    return {
      companyId,
      sourceId,
      discovered: jobs.length,
      deactivated: staleIds.length,
      inspectionsQueued: toInspect.length,
      greenhouseReportedTotal: payload.meta?.total ?? jobs.length,
      syncedAt,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markSourceFailure(sourceId, message);
    throw error;
  }
}

export async function syncDueGreenhouseBoards(limit = 20) {
  const safeLimit = Math.max(1, Math.min(limit, 50));
  const { data: companies, error } = await supabaseAdmin
    .from("companies")
    .select("id,name,careers_url,ats_identifier,last_scanned_at")
    .eq("ats_type", "greenhouse")
    .eq("active", true)
    .not("ats_identifier", "is", null)
    .order("last_scanned_at", { ascending: true, nullsFirst: true })
    .limit(safeLimit);

  if (error) throw new Error(error.message);

  const targets = (companies ?? []).filter(
    (company): company is typeof company & { ats_identifier: string } =>
      Boolean(company.ats_identifier),
  );

  const results: Array<{
    boardToken: string;
    ok: boolean;
    discovered?: number;
    deactivated?: number;
    inspectionsQueued?: number;
    error?: string;
  }> = [];

  for (let index = 0; index < targets.length; index += 4) {
    const chunk = targets.slice(index, index + 4);
    const settled = await Promise.allSettled(
      chunk.map((company) =>
        syncGreenhouseTarget({
          companyId: company.id,
          companyName: company.name,
          careersUrl: company.careers_url,
          boardToken: company.ats_identifier,
          requestedBy: null,
        }),
      ),
    );

    settled.forEach((result, resultIndex) => {
      const boardToken = chunk[resultIndex]?.ats_identifier ?? "unknown";
      if (result.status === "fulfilled") {
        results.push({
          boardToken,
          ok: true,
          discovered: result.value.discovered,
          deactivated: result.value.deactivated,
          inspectionsQueued: result.value.inspectionsQueued,
        });
      } else {
        results.push({
          boardToken,
          ok: false,
          error:
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason),
        });
      }
    });
  }

  return {
    boardsAttempted: results.length,
    succeeded: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
    discovered: results.reduce(
      (sum, result) => sum + (result.discovered ?? 0),
      0,
    ),
    deactivated: results.reduce(
      (sum, result) => sum + (result.deactivated ?? 0),
      0,
    ),
    inspectionsQueued: results.reduce(
      (sum, result) => sum + (result.inspectionsQueued ?? 0),
      0,
    ),
    results,
  };
}
