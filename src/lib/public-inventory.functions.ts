import { createServerFn } from "@tanstack/react-start";

const FORM_FRESHNESS_MS = 48 * 60 * 60 * 1000;
const SOURCE_FRESHNESS_MS = 3 * 60 * 60 * 1000;

export const getPublicInventorySummary = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const formCutoff = new Date(Date.now() - FORM_FRESHNESS_MS).toISOString();
    const sourceCutoff = new Date(
      Date.now() - SOURCE_FRESHNESS_MS,
    ).toISOString();

    const baseCountQuery = supabaseAdmin
      .from("jobs")
      .select("id,job_sources!inner(last_synced_at,last_sync_status)", {
        count: "exact",
        head: true,
      })
      .eq("is_active", true)
      .eq("auto_apply_eligible", true)
      .gte("last_verified_at", formCutoff)
      .eq("job_sources.last_sync_status", "success")
      .gte("job_sources.last_synced_at", sourceCutoff);

    const baseDataQuery = supabaseAdmin
      .from("jobs")
      .select(
        "last_verified_at,source_updated_at,companies(name),job_sources!inner(last_synced_at,last_sync_status)",
      )
      .eq("is_active", true)
      .eq("auto_apply_eligible", true)
      .gte("last_verified_at", formCutoff)
      .eq("job_sources.last_sync_status", "success")
      .gte("job_sources.last_synced_at", sourceCutoff)
      .order("source_updated_at", { ascending: false, nullsFirst: false })
      .limit(250);

    const [{ count }, { data, error }] = await Promise.all([
      baseCountQuery,
      baseDataQuery,
    ]);

    if (error) throw new Error(error.message);

    const companies = Array.from(
      new Set(
        (data ?? [])
          .map((row) => row.companies?.name?.trim())
          .filter((name): name is string => Boolean(name)),
      ),
    )
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 24);

    const timestamps = (data ?? [])
      .flatMap((row) => [
        row.job_sources?.last_synced_at,
        row.last_verified_at,
      ])
      .filter((value): value is string => Boolean(value))
      .map((value) => new Date(value).getTime())
      .filter(Number.isFinite);

    return {
      eligibleJobs: count ?? 0,
      companies,
      lastUpdatedAt: timestamps.length
        ? new Date(Math.max(...timestamps)).toISOString()
        : null,
    };
  });
