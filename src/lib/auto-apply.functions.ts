import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Auto Apply inventory: only jobs a supported adapter can submit AND verify.
 * RLS already restricts the jobs table to auto_apply_eligible rows.
 */
export const listAutoApplyJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: jobs }, { data: matches }] = await Promise.all([
      supabase
        .from("jobs")
        .select("id, title, location, remote_type, employment_type, seniority, salary_min, salary_max, salary_currency, published_at, auto_apply_adapter, company_id, companies(name, logo_url)")
        .eq("auto_apply_eligible", true)
        .eq("is_active", true)
        .limit(200),
      supabase.from("job_matches").select("*").eq("user_id", userId),
    ]);

    const matchByJob = new Map((matches ?? []).map((m) => [m.job_id, m]));
    const ready = (jobs ?? []).map((job) => {
      const match = matchByJob.get(job.id);
      return {
        id: job.id,
        title: job.title,
        company: job.companies?.name ?? "",
        logoUrl: job.companies?.logo_url ?? null,
        location: job.location,
        remoteType: job.remote_type,
        adapter: job.auto_apply_adapter,
        matchScore: match ? Number(match.match_score) : null,
        explanation: match?.explanation ?? null,
      };
    });

    return { readyCount: ready.length, jobs: ready };
  });

export const getAutoApplyOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [ready, attempts, credits, subscription, consent] = await Promise.all([
      supabase.from("jobs").select("id", { count: "exact", head: true }).eq("auto_apply_eligible", true).eq("is_active", true),
      supabase.from("application_attempts").select("status").eq("user_id", userId),
      supabase.from("application_credits").select("*").eq("user_id", userId).order("period_start", { ascending: false }).limit(1),
      supabase.from("subscriptions").select("plan_code, status, plans(weekly_application_limit, name)").eq("user_id", userId).maybeSingle(),
      supabase.from("auto_apply_consents").select("authorized, revoked_at").eq("user_id", userId).maybeSingle(),
    ]);

    const statuses = attempts.data ?? [];
    return {
      readyCount: ready.count ?? 0,
      verified: statuses.filter((s) => s.status === "verified").length,
      processing: statuses.filter((s) => ["preparing", "resume_generating", "ready", "submitting", "submitted_unverified"].includes(s.status)).length,
      queued: statuses.filter((s) => s.status === "queued").length,
      failed: statuses.filter((s) => s.status.startsWith("failed")).length,
      weeklyLimit: subscription.data?.plans?.weekly_application_limit ?? null,
      planName: subscription.data?.plans?.name ?? null,
      subscriptionStatus: subscription.data?.status ?? "inactive",
      creditsConsumed: credits.data?.[0]?.consumed ?? 0,
      consentGranted: consent.data?.authorized === true && !consent.data?.revoked_at,
    };
  });

/**
 * Batch Auto Apply. Creates a batch row and enqueues every eligible job through
 * the database enqueue function. Nothing is submitted here — the external
 * worker claims the queue. No credit is consumed until a submission is verified.
 */
export const startAutoApplyBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { jobIds: string[] }) => {
    if (!Array.isArray(data.jobIds) || data.jobIds.length === 0) throw new Error("Seleccioná al menos un trabajo.");
    return { jobIds: data.jobIds.slice(0, 500) };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: consent } = await supabase.from("auto_apply_consents").select("authorized, revoked_at").eq("user_id", userId).maybeSingle();
    if (!consent?.authorized || consent.revoked_at) return { status: "consent_required" as const, batchId: null, results: {} };

    const { data: subscription } = await supabase.from("subscriptions").select("status, plans(weekly_application_limit)").eq("user_id", userId).maybeSingle();
    if (subscription?.status !== "active") return { status: "subscription_required" as const, batchId: null, results: {} };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: batch, error: batchError } = await supabaseAdmin
      .from("application_batches")
      .insert({ user_id: userId, total_selected: data.jobIds.length, status: "open" })
      .select("id")
      .single();
    if (batchError) throw new Error(batchError.message);

    const results: Record<string, number> = {};
    for (const jobId of data.jobIds) {
      const { data: outcome } = await supabaseAdmin.rpc("enqueue_application", { _user_id: userId, _job_id: jobId, _batch_id: batch.id, _priority: 100 });
      const key = (outcome as string) ?? "error";
      results[key] = (results[key] ?? 0) + 1;
    }

    return { status: "queued" as const, batchId: batch.id, results };
  });

export const getBatchProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { batchId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [{ data: batch }, { data: attempts }] = await Promise.all([
      supabase.from("application_batches").select("*").eq("id", data.batchId).eq("user_id", userId).maybeSingle(),
      supabase
        .from("application_attempts")
        .select("id, status, error_message, submitted_at, verified_at, jobs(title, companies(name))")
        .eq("batch_id", data.batchId)
        .eq("user_id", userId)
        .order("queued_at", { ascending: true }),
    ]);
    return {
      batch,
      attempts: (attempts ?? []).map((a) => ({
        id: a.id,
        status: a.status,
        title: a.jobs?.title ?? "",
        company: a.jobs?.companies?.name ?? "",
        errorMessage: a.error_message,
      })),
    };
  });

export const listMyApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("application_attempts")
      .select("id, status, queued_at, submitted_at, verified_at, adapter, submission_reference, jobs(title, location, companies(name))")
      .eq("user_id", context.userId)
      .order("queued_at", { ascending: false })
      .limit(200);
    return (data ?? []).map((a) => ({
      id: a.id,
      status: a.status,
      title: a.jobs?.title ?? "",
      company: a.jobs?.companies?.name ?? "",
      adapter: a.adapter,
      submittedAt: a.submitted_at,
      verifiedAt: a.verified_at,
      reference: a.submission_reference,
    }));
  });
