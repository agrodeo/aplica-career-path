import { createServerFn } from "@tanstack/react-start";

export const getPublicInventoryStats = createServerFn({ method: "GET" }).handler(
  async () => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const [
      active,
      eligible,
      companies,
      lastScanned,
    ] = await Promise.all([
      supabaseAdmin
        .from("jobs")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),
      supabaseAdmin
        .from("jobs")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("auto_apply_eligible", true),
      supabaseAdmin
        .from("companies")
        .select("id", { count: "exact", head: true })
        .eq("active", true),
      supabaseAdmin
        .from("companies")
        .select("last_scanned_at")
        .eq("active", true)
        .not("last_scanned_at", "is", null)
        .order("last_scanned_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    return {
      activeJobs: active.count ?? 0,
      readyJobs: eligible.count ?? 0,
      companies: companies.count ?? 0,
      lastUpdatedAt: lastScanned.data?.last_scanned_at ?? null,
    };
  },
);
