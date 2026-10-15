import { supabase } from "@/integrations/supabase/client";

async function requireAdmin() {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error("Sesión no válida.");
  const { data: role, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", auth.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !role) throw new Error("Forbidden");
  return auth.user.id;
}

export async function amIAdmin() {
  try {
    await requireAdmin();
    return { isAdmin: true };
  } catch {
    return { isAdmin: false };
  }
}

export async function getAdminDashboard() {
  await requireAdmin();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [totalJobs, activeJobs, eligibleJobs, adapters, attemptsToday, byAts] = await Promise.all([
    supabase.from("jobs").select("id", { count: "exact", head: true }),
    supabase.from("jobs").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("jobs").select("id", { count: "exact", head: true }).eq("auto_apply_eligible", true).eq("is_active", true),
    supabase.from("adapter_registry").select("*").order("adapter"),
    supabase.from("application_attempts").select("status,adapter").gte("queued_at", since),
    supabase.from("jobs").select("ats_type"),
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
}
