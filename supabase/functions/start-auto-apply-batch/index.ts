import { createSupabaseContext } from "npm:@supabase/server@1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const { data: ctx, error: authError } = await createSupabaseContext(req, { auth: "user" });
  if (authError || !ctx?.userClaims?.sub) {
    return json({ error: authError?.message ?? "unauthorized" }, authError?.status ?? 401);
  }

  const body = await req.json().catch(() => ({})) as { jobIds?: unknown };
  if (!Array.isArray(body.jobIds) || body.jobIds.length === 0) {
    return json({ error: "Seleccioná al menos un trabajo." }, 400);
  }

  const jobIds = [...new Set(body.jobIds.filter((id): id is string => typeof id === "string"))].slice(0, 500);
  const userId = String(ctx.userClaims.sub);
  const admin = ctx.supabaseAdmin;

  const [{ data: consent }, { data: subscription }, { data: selectedJobs }, { data: preference }] =
    await Promise.all([
      admin.from("auto_apply_consents").select("authorized, revoked_at").eq("user_id", userId).maybeSingle(),
      admin.from("subscriptions").select("status,current_period_start,current_period_end,plans(weekly_application_limit)").eq("user_id", userId).maybeSingle(),
      admin.from("jobs").select("id").in("id", jobIds).eq("auto_apply_eligible", true).eq("is_active", true),
      admin.from("job_preferences").select("minimum_match_score").eq("user_id", userId).maybeSingle(),
    ]);

  if (!consent?.authorized || consent.revoked_at) {
    return json({ status: "consent_required", batchId: null, results: {} });
  }
  if (subscription?.status !== "active") {
    return json({ status: "subscription_required", batchId: null, results: {} });
  }

  const allowedIds = new Set((selectedJobs ?? []).map((job: { id: string }) => job.id));
  const unavailable = jobIds.filter((id) => !allowedIds.has(id));
  if (unavailable.length) {
    return json({ status: "jobs_unavailable", batchId: null, results: { unavailable: unavailable.length } });
  }

  const minimum = Number(preference?.minimum_match_score ?? 70);
  const { data: selectedMatches } = await admin.from("job_matches")
    .select("job_id,match_score,hard_requirements_met")
    .eq("user_id", userId)
    .in("job_id", jobIds);

  const qualifiedIds = new Set(
    (selectedMatches ?? [])
      .filter((match: { hard_requirements_met: boolean; match_score: number | string }) =>
        match.hard_requirements_met && Number(match.match_score) >= minimum)
      .map((match: { job_id: string }) => match.job_id),
  );
  if (qualifiedIds.size !== jobIds.length) {
    return json({
      status: "jobs_unavailable",
      batchId: null,
      results: { below_match_threshold: jobIds.length - qualifiedIds.size },
    });
  }

  const weeklyLimit = subscription.plans?.weekly_application_limit ?? null;
  if (weeklyLimit != null) {
    const now = new Date();
    const periodStart = subscription.current_period_start ??
      new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - ((now.getUTCDay() + 6) % 7),
      )).toISOString();
    const periodEnd = subscription.current_period_end ??
      new Date(new Date(periodStart).getTime() + 7 * 86400000).toISOString();

    const [{ data: credits }, { count: outstanding }] = await Promise.all([
      admin.from("application_credits")
        .select("consumed")
        .eq("user_id", userId)
        .gte("period_start", periodStart.slice(0, 10))
        .lt("period_start", periodEnd.slice(0, 10)),
      admin.from("application_attempts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("queued_at", periodStart)
        .lt("queued_at", periodEnd)
        .in("status", [
          "queued","preparing","resume_generating","ready","submitting",
          "submitted_unverified","failed_retryable",
        ]),
    ]);

    const consumed = (credits ?? []).reduce(
      (sum: number, row: { consumed?: number | null }) => sum + (row.consumed ?? 0),
      0,
    );
    const remaining = Math.max(Number(weeklyLimit) - consumed - (outstanding ?? 0), 0);
    if (jobIds.length > remaining) {
      return json({
        status: "limit_exceeded",
        batchId: null,
        results: { requested: jobIds.length, remaining, weekly_limit: weeklyLimit },
      });
    }
  }

  const { data: batch, error: batchError } = await admin.from("application_batches")
    .insert({ user_id: userId, total_selected: jobIds.length, status: "open" })
    .select("id")
    .single();
  if (batchError || !batch) return json({ error: batchError?.message ?? "batch_create_failed" }, 500);

  const results: Record<string, number> = {};
  for (const jobId of jobIds) {
    const { data: outcome, error } = await admin.rpc("enqueue_application", {
      _user_id: userId,
      _job_id: jobId,
      _batch_id: batch.id,
      _priority: 100,
    });
    const key = error ? "error" : String(outcome ?? "error");
    results[key] = (results[key] ?? 0) + 1;
  }

  const queuedCount = results["queued"] ?? 0;
  if (queuedCount === 0) {
    await admin.from("application_batches").delete().eq("id", batch.id).eq("user_id", userId);
    return json({ status: "jobs_unavailable", batchId: null, results });
  }

  if (queuedCount !== jobIds.length) {
    await admin.from("application_batches")
      .update({ total_selected: queuedCount })
      .eq("id", batch.id)
      .eq("user_id", userId);
  }

  return json({ status: "queued", batchId: batch.id, results });
});
