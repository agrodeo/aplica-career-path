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


/**
 * Returns a small list of real, structurally eligible jobs for the current
 * admin's profile-aware dry-run console. No other user's profile is exposed.
 */
export const listAdminDryRunJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data, error } = await supabaseAdmin
      .from("jobs")
      .select(
        "id,title,location,ats_type,auto_apply_adapter,application_url,companies(name)",
      )
      .eq("auto_apply_eligible", true)
      .eq("is_active", true)
      .not("application_url", "is", null)
      .order("last_verified_at", { ascending: false, nullsFirst: false })
      .limit(60);

    if (error) throw new Error(error.message);

    return (data ?? []).map((job) => ({
      id: job.id,
      title: job.title,
      company: job.companies?.name ?? "",
      location: job.location,
      atsType: job.ats_type,
      adapter: job.auto_apply_adapter,
      applicationUrl: job.application_url,
    }));
  });

/**
 * Queues exactly one dry-run against the signed-in admin's own confirmed
 * profile. It bypasses billing only because the database marks the queue item
 * test_mode=true; both worker and backend refuse to turn it into a verified
 * paid submission.
 */
export const queueAdminDryRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { jobId: string }) => {
    const jobId = data.jobId.trim();
    if (!/^[0-9a-f-]{36}$/i.test(jobId)) throw new Error("Trabajo inválido.");
    return { jobId };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: profile }, { data: consent }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id,first_name,last_name,base_resume_path")
        .eq("user_id", context.userId)
        .maybeSingle(),
      supabaseAdmin
        .from("auto_apply_consents")
        .select("authorized,revoked_at")
        .eq("user_id", context.userId)
        .maybeSingle(),
    ]);

    if (!profile) {
      throw new Error("Completá tu onboarding antes de correr un dry run.");
    }
    if (!profile.base_resume_path) {
      throw new Error("Tu perfil necesita un CV base antes del dry run.");
    }
    if (!consent?.authorized || consent.revoked_at) {
      throw new Error("Falta tu autorización de Auto Apply.");
    }

    const { data: queueId, error } = await supabaseAdmin.rpc(
      "enqueue_admin_dry_run",
      {
        _user_id: context.userId,
        _job_id: data.jobId,
      },
    );
    if (error) throw new Error(error.message);

    return {
      queueId,
      profile: [profile.first_name, profile.last_name]
        .filter(Boolean)
        .join(" "),
    };
  });

export const listAdminDryRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data, error } = await supabaseAdmin
      .from("application_attempts")
      .select(
        "id,job_id,status,error_code,error_message,queued_at,started_at,created_at,jobs(title,companies(name))",
      )
      .eq("user_id", context.userId)
      .eq("test_mode", true)
      .order("queued_at", { ascending: false })
      .limit(12);

    if (error) throw new Error(error.message);

    return (data ?? []).map((attempt) => ({
      id: attempt.id,
      jobId: attempt.job_id,
      title: attempt.jobs?.title ?? "",
      company: attempt.jobs?.companies?.name ?? "",
      status: attempt.status,
      errorCode: attempt.error_code,
      errorMessage: attempt.error_message,
      queuedAt: attempt.queued_at,
      startedAt: attempt.started_at,
    }));
  });
