import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function words(value: string) {
  return new Set(
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(/[^a-z0-9+#.]+/)
      .map((word) => word.trim())
      .filter((word) => word.length > 1),
  );
}

function similarity(a: string, b: string): number {
  const left = words(a);
  const right = words(b);
  if (!left.size || !right.size) return 0;
  const intersection = [...left].filter((word) => right.has(word)).length;
  const union = new Set([...left, ...right]).size;
  const jaccard = union ? intersection / union : 0;
  const contains = a.toLowerCase().includes(b.toLowerCase()) || b.toLowerCase().includes(a.toLowerCase());
  return Math.min(100, Math.round((contains ? 0.7 : 0) * 100 + jaccard * 70));
}

function normalizeMode(value: string | null) {
  const mode = (value ?? "").toLowerCase();
  if (/remote|remoto/.test(mode)) return "remote";
  if (/hybrid|hibr|híbr/.test(mode)) return "hybrid";
  if (/onsite|on-site|presencial|office/.test(mode)) return "onsite";
  return "unknown";
}

function includesLoose(haystack: string | null, needle: string) {
  if (!haystack || !needle) return false;
  const left = haystack.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const right = needle.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return left.includes(right) || right.includes(left);
}


/**
 * Auto Apply inventory: only jobs a supported adapter can submit AND verify.
 * RLS already restricts the jobs table to auto_apply_eligible rows.
 */
export const listAutoApplyJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: jobs }, { data: matches }, { data: preferences }] = await Promise.all([
      supabase
        .from("jobs")
        .select("id, title, location, remote_type, employment_type, seniority, salary_min, salary_max, salary_currency, published_at, auto_apply_adapter, company_id, companies(name, logo_url)")
        .eq("auto_apply_eligible", true)
        .eq("is_active", true)
        .limit(500),
      supabase.from("job_matches").select("*").eq("user_id", userId),
      supabase.from("job_preferences").select("minimum_match_score").eq("user_id", userId).maybeSingle(),
    ]);

    const minimum = Number(preferences?.minimum_match_score ?? 70);
    const matchByJob = new Map((matches ?? []).map((match) => [match.job_id, match]));
    const ready = (jobs ?? [])
      .map((job) => {
        const match = matchByJob.get(job.id);
        return {
          id: job.id,
          title: job.title,
          company: job.companies?.name ?? "",
          logoUrl: job.companies?.logo_url ?? null,
          location: job.location,
          remoteType: job.remote_type,
          employmentType: job.employment_type,
          seniority: job.seniority,
          salaryMin: job.salary_min,
          salaryMax: job.salary_max,
          salaryCurrency: job.salary_currency,
          publishedAt: job.published_at,
          adapter: job.auto_apply_adapter,
          matchScore: match ? Number(match.match_score) : null,
          hardRequirementsMet: match?.hard_requirements_met ?? false,
          explanation: match?.explanation ?? null,
        };
      })
      .filter((job) => job.hardRequirementsMet && job.matchScore !== null && job.matchScore >= minimum)
      .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));

    return { readyCount: ready.length, minimumMatchScore: minimum, jobs: ready };
  });

export const refreshJobMatches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [profile, experiences, skills, preferences, jobs] = await Promise.all([
      supabase.from("profiles").select("current_title, city, country").eq("user_id", userId).maybeSingle(),
      supabase.from("experiences").select("title").eq("user_id", userId),
      supabase.from("skills").select("name").eq("user_id", userId),
      supabase.from("job_preferences").select("*").eq("user_id", userId).maybeSingle(),
      supabase
        .from("jobs")
        .select("id, title, description, location, country, remote_type, employment_type, seniority, companies(name)")
        .eq("auto_apply_eligible", true)
        .eq("is_active", true)
        .limit(500),
    ]);

    const pref = preferences.data;
    const targetRoles = pref?.target_roles ?? [];
    const targetLocations = pref?.target_locations ?? [];
    const desiredSeniorities = pref?.seniority_levels ?? [];
    const desiredEmployment = pref?.employment_types ?? [];
    const userSkills = (skills.data ?? []).map((skill) => skill.name).filter(Boolean);
    const experienceTitles = [
      profile.data?.current_title ?? "",
      ...(experiences.data ?? []).map((experience) => experience.title),
    ].filter(Boolean);

    const rows = (jobs.data ?? []).map((job) => {
      const roleCandidates = [...targetRoles, ...experienceTitles];
      const roleScore = roleCandidates.length
        ? Math.max(...roleCandidates.map((role) => similarity(role, job.title)))
        : 50;

      const jobText = `${job.title} ${job.description ?? ""}`.toLowerCase();
      const matchedSkills = userSkills.filter((skill) => includesLoose(jobText, skill));
      const skillsScore = userSkills.length
        ? Math.round((matchedSkills.length / Math.min(userSkills.length, 8)) * 100)
        : 50;

      const experienceScore = experienceTitles.length
        ? Math.max(...experienceTitles.map((title) => similarity(title, job.title)))
        : 40;

      const mode = normalizeMode(job.remote_type);
      const modeAllowed =
        mode === "remote"
          ? pref?.remote_allowed !== false
          : mode === "hybrid"
            ? pref?.hybrid_allowed !== false
            : mode === "onsite"
              ? pref?.onsite_allowed === true
              : true;

      let locationScore = 70;
      if (mode === "remote" && pref?.remote_allowed !== false) {
        locationScore = 100;
      } else if (targetLocations.length) {
        locationScore = targetLocations.some(
          (location) =>
            includesLoose(job.location, location) ||
            includesLoose(job.country, location),
        )
          ? 100
          : mode === "remote"
            ? 80
            : 30;
      } else if (
        includesLoose(job.location, profile.data?.city ?? "") ||
        includesLoose(job.country, profile.data?.country ?? "")
      ) {
        locationScore = 100;
      }

      const seniorityScore =
        !desiredSeniorities.length || !job.seniority
          ? 70
          : desiredSeniorities.some((level) => includesLoose(job.seniority, level))
            ? 100
            : 45;

      const employmentScore =
        !desiredEmployment.length || !job.employment_type
          ? 80
          : desiredEmployment.some((type) => includesLoose(job.employment_type, type))
            ? 100
            : 50;

      const hardRequirementsMet = modeAllowed;
      const weighted =
        roleScore * 0.35 +
        skillsScore * 0.3 +
        experienceScore * 0.15 +
        locationScore * 0.1 +
        seniorityScore * 0.05 +
        employmentScore * 0.05;

      const matchScore = Math.max(0, Math.min(100, Math.round(weighted)));

      return {
        user_id: userId,
        job_id: job.id,
        match_score: matchScore,
        role_score: roleScore,
        skills_score: Math.min(100, skillsScore),
        experience_score: experienceScore,
        location_score: locationScore,
        seniority_score: seniorityScore,
        preferences_score: employmentScore,
        hard_requirements_met: hardRequirementsMet,
        explanation: {
          matchedSkills,
          targetRole: targetRoles[0] ?? profile.data?.current_title ?? null,
          mode: job.remote_type,
          location: job.location,
          note: "El match compara perfil y vacante; no es una probabilidad de contratación.",
        },
        created_at: new Date().toISOString(),
      };
    });

    if (rows.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin
        .from("job_matches")
        .upsert(rows, { onConflict: "user_id,job_id" });
      if (error) throw new Error(error.message);
    }

    const minimum = Number(pref?.minimum_match_score ?? 70);
    return {
      totalEligibleInventory: rows.length,
      readyCount: rows.filter(
        (row) => row.hard_requirements_met && Number(row.match_score) >= minimum,
      ).length,
      minimumMatchScore: minimum,
    };
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
