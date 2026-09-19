import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> }, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (data !== true) throw new Error("Forbidden");
}

/** Admin-only observability over discovery, eligibility and submissions. */
export const getAdminDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [totalJobs, activeJobs, eligibleJobs, adapters, attemptsToday, byAts] = await Promise.all([
      supabaseAdmin.from("jobs").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("jobs").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabaseAdmin.from("jobs").select("id", { count: "exact", head: true }).eq("auto_apply_eligible", true).eq("is_active", true),
      supabaseAdmin.from("adapter_registry").select("*").order("adapter"),
      supabaseAdmin.from("application_attempts").select("status, adapter").gte("queued_at", since),
      supabaseAdmin.from("jobs").select("ats_type"),
    ]);

    const attempts = attemptsToday.data ?? [];
    const verified = attempts.filter((a) => a.status === "verified").length;
    const failed = attempts.filter((a) => a.status.startsWith("failed")).length;
    const duplicates = attempts.filter((a) => a.status === "duplicate").length;
    const expired = attempts.filter((a) => a.status === "expired").length;

    const atsCounts: Record<string, number> = {};
    for (const row of byAts.data ?? []) {
      const key = row.ats_type ?? "unknown";
      atsCounts[key] = (atsCounts[key] ?? 0) + 1;
    }

    const total = totalJobs.count ?? 0;
    const eligible = eligibleJobs.count ?? 0;

    return {
      jobsDiscovered: total,
      activeJobs: activeJobs.count ?? 0,
      autoApplyEligible: eligible,
      eligibilityRate: total ? Math.round((eligible / total) * 1000) / 10 : 0,
      applicationsToday: attempts.length,
      verifiedSubmissions: verified,
      failedSubmissions: failed,
      successRate: attempts.length ? Math.round((verified / attempts.length) * 1000) / 10 : 0,
      duplicateRate: attempts.length ? Math.round((duplicates / attempts.length) * 1000) / 10 : 0,
      expiredRate: attempts.length ? Math.round((expired / attempts.length) * 1000) / 10 : 0,
      jobsByAts: atsCounts,
      adapters: (adapters.data ?? []).map((a) => ({
        adapter: a.adapter,
        label: a.label,
        health: a.health,
        connectionStatus: a.connection_status,
        submission: a.submission,
        verification: a.verification,
        lastError: a.last_error,
        lastCheckedAt: a.last_checked_at,
      })),
    };
  });

export const amIAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    return { isAdmin: data === true };
  });
