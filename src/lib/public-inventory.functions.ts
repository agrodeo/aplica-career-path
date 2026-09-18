import { createServerFn } from "@tanstack/react-start";

export const getPublicInventorySummary = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ count }, { data, error }] = await Promise.all([
      supabaseAdmin
        .from("jobs")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("auto_apply_eligible", true),
      supabaseAdmin
        .from("jobs")
        .select("last_verified_at,source_updated_at,companies(name)")
        .eq("is_active", true)
        .eq("auto_apply_eligible", true)
        .order("source_updated_at", { ascending: false, nullsFirst: false })
        .limit(250),
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
      .flatMap((row) => [row.source_updated_at, row.last_verified_at])
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
