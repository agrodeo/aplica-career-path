import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

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


type StoredApplicationField = {
  label?: string;
  answerKey?: string;
  canonicalKey?: string | null;
  type?: string;
  required?: boolean;
  options?: Array<{ label?: string; value?: string }>;
  demographic?: boolean;
};

export type MissingApplicationQuestion = {
  answerKey: string;
  label: string;
  fieldType: string;
  answerType: "boolean" | "text" | "numeric";
  options: Array<{ label: string; value: string }>;
};

type JobWithSchema = {
  id: string;
  application_schema_id: string | null;
};

function hasDeclineOption(options: StoredApplicationField["options"]) {
  return (options ?? []).some((option) =>
    /decline|prefer not|do not wish|no deseo|prefiero no/i.test(
      option.label ?? "",
    ),
  );
}

function isBooleanOptions(options: StoredApplicationField["options"]) {
  const labels = (options ?? [])
    .flatMap((option) => [option.label ?? "", option.value ?? ""])
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const hasYes = labels.some((value) => /^(yes|sí|si|true)$/.test(value));
  const hasNo = labels.some((value) => /^(no|false)$/.test(value));
  return hasYes && hasNo;
}

function questionType(field: StoredApplicationField): MissingApplicationQuestion["answerType"] {
  if (field.type === "checkbox") return "boolean";
  if (field.type === "radio" && isBooleanOptions(field.options)) return "boolean";
  if (field.canonicalKey === "years_experience") return "numeric";
  return "text";
}

async function applicationReadiness(
  supabase: SupabaseClient<Database>,
  userId: string,
  jobs: JobWithSchema[],
): Promise<Map<string, MissingApplicationQuestion[]>> {
  const result = new Map<string, MissingApplicationQuestion[]>();
  for (const job of jobs) result.set(job.id, []);
  if (!jobs.length) return result;

  const schemaIds = jobs
    .map((job) => job.application_schema_id)
    .filter((id): id is string => Boolean(id));

  const [
    { data: profile },
    { data: experiences },
    { data: answers },
    { data: careerContext },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "first_name,last_name,email,phone,city,country,linkedin_url,portfolio_url,current_title,professional_summary,base_resume_path",
      )
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("experiences")
      .select("company,title,achievements")
      .eq("user_id", userId)
      .limit(5),
    supabase
      .from("application_answers")
      .select(
        "canonical_key,answer_type,boolean_value,text_value,numeric_value,user_confirmed",
      )
      .eq("user_id", userId)
      .eq("user_confirmed", true),
    supabase
      .from("career_contexts")
      .select(
        "preferred_tasks,strengths,differentiators,results,proud_project,challenge_story,career_goal",
      )
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  const confirmed = new Set((answers ?? []).map((answer) => answer.canonical_key));
  const answerByKey = new Map(
    (answers ?? []).map((answer) => [answer.canonical_key, answer]),
  );
  const currentExperience = experiences?.[0] ?? null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: schemas, error: schemaError } = schemaIds.length
    ? await supabaseAdmin
        .from("application_schemas")
        .select("id,job_id,fields,valid")
        .in("id", schemaIds)
    : { data: [], error: null };

  if (schemaError) throw new Error(schemaError.message);

  const schemaById = new Map(
    (schemas ?? []).map((schema) => [schema.id, schema]),
  );

  const coveredCanonical = (key: string): boolean => {
    switch (key) {
      case "first_name":
        return Boolean(profile?.first_name);
      case "last_name":
        return Boolean(profile?.last_name);
      case "full_name":
        return Boolean(profile?.first_name && profile?.last_name);
      case "email":
        return Boolean(profile?.email);
      case "phone":
        return Boolean(profile?.phone);
      case "location":
        return Boolean(profile?.city || profile?.country);
      case "country":
        return Boolean(profile?.country);
      case "linkedin":
        return Boolean(profile?.linkedin_url);
      case "portfolio":
      case "website":
        return Boolean(profile?.portfolio_url);
      case "current_company":
        return Boolean(currentExperience?.company);
      case "current_title":
        return Boolean(profile?.current_title || currentExperience?.title);
      case "years_experience":
        return Boolean(experiences?.length);
      case "resume":
        return Boolean(
          profile?.first_name &&
            profile?.last_name &&
            (profile?.current_title || experiences?.length || profile?.base_resume_path),
        );
      case "cover_letter":
        return Boolean(
          profile?.professional_summary ||
            experiences?.length ||
            careerContext?.results?.length,
        );
      case "motivation":
        return Boolean(
          careerContext?.career_goal ||
            careerContext?.preferred_tasks?.length ||
            careerContext?.results?.length,
        );
      case "about_you":
        return Boolean(
          profile?.current_title ||
            experiences?.length ||
            careerContext?.strengths?.length ||
            careerContext?.differentiators?.length,
        );
      case "challenge_story":
        return Boolean(careerContext?.challenge_story);
      case "proud_achievement":
        return Boolean(
          careerContext?.proud_project ||
            careerContext?.results?.length ||
            (experiences ?? []).some(
              (experience) =>
                Array.isArray(experience.achievements) &&
                experience.achievements.length > 0,
            ),
        );
      default:
        return confirmed.has(key);
    }
  };

  for (const job of jobs) {
    const missing: MissingApplicationQuestion[] = [];
    const schema = job.application_schema_id
      ? schemaById.get(job.application_schema_id)
      : null;

    // Structurally eligible jobs should always have a current schema. If the
    // schema vanished, keep the job out of the ready bucket rather than guess.
    if (!schema?.valid) {
      missing.push({
        answerKey: "system:application_schema",
        label: "La vacante necesita volver a verificarse antes de aplicar.",
        fieldType: "system",
        answerType: "text",
        options: [],
      });
      result.set(job.id, missing);
      continue;
    }

    const fields = Array.isArray(schema.fields)
      ? (schema.fields as unknown as StoredApplicationField[])
      : [];

    for (const field of fields) {
      if (!field.required) continue;
      if (field.demographic && hasDeclineOption(field.options)) continue;

      const canonicalKey = field.canonicalKey ?? null;
      const answerKey = (field.answerKey ?? canonicalKey ?? "").trim();

      if (field.type === "checkbox") {
        const storedCheckbox = answerKey ? answerByKey.get(answerKey) : null;
        if (
          storedCheckbox?.answer_type === "boolean" &&
          storedCheckbox.boolean_value === true
        ) {
          continue;
        }
      } else {
        if (canonicalKey && coveredCanonical(canonicalKey)) continue;
        if (!canonicalKey && answerKey && confirmed.has(answerKey)) continue;
      }

      // Required extra files and unknown controls are structural blockers and
      // should already have prevented auto_apply_eligible=true.
      if (field.type === "file" || field.type === "unknown") continue;
      if (!answerKey) continue;

      const options = (field.options ?? [])
        .map((option) => ({
          label: String(option.label ?? "").trim(),
          value: String(option.value ?? "").trim(),
        }))
        .filter((option) => option.label && option.value);

      missing.push({
        answerKey,
        label: (field.label ?? answerKey).replace(/\s*\*\s*$/, "").trim(),
        fieldType: field.type ?? "text",
        answerType: questionType(field),
        options,
      });
    }

    result.set(job.id, missing);
  }

  return result;
}


/**
 * Auto Apply inventory: only jobs a supported adapter can submit AND verify.
 * RLS already restricts the jobs table to auto_apply_eligible rows.
 */
export const listAutoApplyJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { ensureInventoryFresh } = await import("@/lib/job-sync.server");
    await ensureInventoryFresh(20);

    const { supabase, userId } = context;
    const [
      { data: jobs },
      { data: matches },
      { data: preferences },
      { data: verifiedAttempts },
      { data: queuedApplications },
    ] = await Promise.all([
      supabase
        .from("jobs")
        .select(
          "id, title, location, remote_type, employment_type, seniority, salary_min, salary_max, salary_currency, published_at, application_url, ats_type, auto_apply_eligible, auto_apply_adapter, application_schema_id, company_id, companies(name, logo_url, last_scanned_at)",
        )
        .eq("is_active", true)
        .limit(1000),
      supabase.from("job_matches").select("*").eq("user_id", userId),
      supabase
        .from("job_preferences")
        .select("minimum_match_score")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("application_attempts")
        .select("job_id")
        .eq("user_id", userId)
        .eq("status", "verified"),
      supabase
        .from("application_queue")
        .select("job_id")
        .eq("user_id", userId),
    ]);

    const minimum = Number(preferences?.minimum_match_score ?? 70);
    const matchByJob = new Map(
      (matches ?? []).map((match) => [match.job_id, match]),
    );
    const unavailableJobIds = new Set([
      ...(verifiedAttempts ?? []).map((attempt) => attempt.job_id),
      ...(queuedApplications ?? []).map((item) => item.job_id),
    ]);

    const matched = (jobs ?? [])
      .filter((job) => !unavailableJobIds.has(job.id))
      .map((job) => {
        const match = matchByJob.get(job.id);
        return {
          id: job.id,
          title: job.title,
          company: job.companies?.name ?? "",
          logoUrl: job.companies?.logo_url ?? null,
          sourceScannedAt: job.companies?.last_scanned_at ?? null,
          location: job.location,
          remoteType: job.remote_type,
          employmentType: job.employment_type,
          seniority: job.seniority,
          salaryMin: job.salary_min,
          salaryMax: job.salary_max,
          salaryCurrency: job.salary_currency,
          publishedAt: job.published_at,
          applicationUrl: job.application_url,
          atsType: job.ats_type,
          autoApplyEligible: job.auto_apply_eligible,
          adapter: job.auto_apply_adapter,
          applicationSchemaId: job.application_schema_id,
          matchScore: match ? Number(match.match_score) : null,
          hardRequirementsMet: match?.hard_requirements_met ?? false,
          explanation: match?.explanation ?? null,
        };
      })
      .filter(
        (job) =>
          job.hardRequirementsMet &&
          job.matchScore !== null &&
          job.matchScore >= minimum,
      )
      .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));

    const readiness = await applicationReadiness(
      supabase,
      userId,
      matched.map((job) => ({
        id: job.id,
        application_schema_id: job.applicationSchemaId,
      })),
    );

    const ready = matched.map((job) => {
      const missingQuestions = readiness.get(job.id) ?? [];
      const actionableMissingQuestions = missingQuestions.filter(
        (question) => !question.answerKey.startsWith("system:"),
      );
      return {
        ...job,
        missingQuestions,
        readyForUser: job.autoApplyEligible && missingQuestions.length === 0,
        needsUserAnswers: job.autoApplyEligible && actionableMissingQuestions.length > 0,
      };
    });

    const inventoryUpdatedAt = ready
      .map((job) => job.sourceScannedAt)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;

    return {
      inventoryUpdatedAt,
      matchedCount: ready.length,
      readyCount: ready.filter((job) => job.readyForUser).length,
      needsAnswersCount: ready.filter((job) => job.needsUserAnswers).length,
      minimumMatchScore: minimum,
      jobs: ready,
    };
  });

export const getAutoApplyJob = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { jobId: string }) => {
    const jobId = data.jobId.trim();
    if (!/^[0-9a-f-]{36}$/i.test(jobId)) throw new Error("Trabajo inválido.");
    return { jobId };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const [
      { data: job },
      { data: match },
      { data: attempts },
      { data: queue },
    ] = await Promise.all([
      supabase
        .from("jobs")
        .select(
          "id,title,description,location,country,remote_type,employment_type,seniority,salary_min,salary_max,salary_currency,published_at,application_url,ats_type,auto_apply_eligible,auto_apply_adapter,application_schema_id,companies(name,logo_url,website)",
        )
        .eq("id", data.jobId)
        .eq("is_active", true)
        .maybeSingle(),
      supabase
        .from("job_matches")
        .select("match_score,hard_requirements_met,explanation")
        .eq("user_id", userId)
        .eq("job_id", data.jobId)
        .maybeSingle(),
      supabase
        .from("application_attempts")
        .select("status,verified_at,queued_at")
        .eq("user_id", userId)
        .eq("job_id", data.jobId)
        .order("queued_at", { ascending: false })
        .limit(1),
      supabase
        .from("application_queue")
        .select("status")
        .eq("user_id", userId)
        .eq("job_id", data.jobId)
        .maybeSingle(),
    ]);

    if (!job) return null;

    const readiness = await applicationReadiness(supabase, userId, [
      { id: job.id, application_schema_id: job.application_schema_id },
    ]);
    const missingQuestions = readiness.get(job.id) ?? [];
    const latestAttempt = attempts?.[0] ?? null;

    return {
      id: job.id,
      title: job.title,
      description: job.description ?? "",
      company: job.companies?.name ?? "",
      companyWebsite: job.companies?.website ?? null,
      logoUrl: job.companies?.logo_url ?? null,
      location: job.location,
      country: job.country,
      remoteType: job.remote_type,
      employmentType: job.employment_type,
      seniority: job.seniority,
      salaryMin: job.salary_min,
      salaryMax: job.salary_max,
      salaryCurrency: job.salary_currency,
      publishedAt: job.published_at,
      applicationUrl: job.application_url,
      atsType: job.ats_type,
      autoApplyEligible: job.auto_apply_eligible,
      adapter: job.auto_apply_adapter,
      matchScore: match ? Number(match.match_score) : null,
      hardRequirementsMet: match?.hard_requirements_met ?? false,
      explanation: match?.explanation ?? null,
      missingQuestions,
      readyForUser: missingQuestions.length === 0,
      applicationStatus:
        latestAttempt?.status ??
        queue?.status ??
        null,
      verifiedAt: latestAttempt?.verified_at ?? null,
    };
  });

export const refreshJobMatches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { ensureInventoryFresh } = await import("@/lib/job-sync.server");
    const { scoreStructuredMatch } = await import("@/lib/job-matching");
    await ensureInventoryFresh(20);

    const { supabase, userId } = context;

    const [
      profile,
      experiences,
      skills,
      languages,
      educations,
      preferences,
      careerContext,
      verifiedAnswers,
      jobs,
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("current_title, city, country")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("experiences")
        .select("company,title,start_date,end_date,is_current,description,achievements")
        .eq("user_id", userId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("skills")
        .select("name,years_experience")
        .eq("user_id", userId),
      supabase
        .from("languages")
        .select("language,level")
        .eq("user_id", userId),
      supabase
        .from("educations")
        .select("degree,field")
        .eq("user_id", userId),
      supabase
        .from("job_preferences")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("career_contexts")
        .select("preferred_tasks,avoid_tasks,tools,target_environment,career_goal")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("application_answers")
        .select("canonical_key,boolean_value,text_value,user_confirmed")
        .eq("user_id", userId)
        .eq("user_confirmed", true),
      supabase
        .from("jobs")
        .select(
          "id,title,description,location,country,remote_type,employment_type,seniority,salary_min,salary_max,salary_currency,auto_apply_eligible,companies(name)",
        )
        .eq("is_active", true)
        .limit(1500),
    ]);

    const pref = preferences.data;
    const careerData = careerContext.data;

    const candidate = {
      currentTitle: profile.data?.current_title ?? "",
      city: profile.data?.city ?? "",
      country: profile.data?.country ?? "",
      targetRoles: pref?.target_roles ?? [],
      targetLocations: pref?.target_locations ?? [],
      remoteAllowed: pref?.remote_allowed !== false,
      hybridAllowed: pref?.hybrid_allowed !== false,
      onsiteAllowed: pref?.onsite_allowed === true,
      employmentTypes: pref?.employment_types ?? [],
      seniorityLevels: pref?.seniority_levels ?? [],
      willingToRelocate: pref?.willing_to_relocate === true,
      internationalRemote: pref?.international_remote !== false,
      minimumSalary:
        pref?.minimum_salary == null ? null : Number(pref.minimum_salary),
      salaryCurrency: pref?.salary_currency ?? null,
      skills: (skills.data ?? []).map((skill) => ({
        name: skill.name,
        yearsExperience:
          skill.years_experience == null ? null : Number(skill.years_experience),
      })),
      languages: (languages.data ?? []).map((language) => ({
        language: language.language,
        level: language.level,
      })),
      education: (educations.data ?? []).map((education) => ({
        degree: education.degree ?? "",
        field: education.field ?? "",
      })),
      experiences: (experiences.data ?? []).map((experience) => ({
        title: experience.title,
        company: experience.company,
        startDate: experience.start_date,
        endDate: experience.end_date,
        isCurrent: experience.is_current,
        description: experience.description ?? "",
        achievements: Array.isArray(experience.achievements)
          ? experience.achievements.map(String)
          : [],
      })),
      tools: careerData?.tools ?? [],
      preferredTasks: careerData?.preferred_tasks ?? [],
      avoidTasks: careerData?.avoid_tasks ?? [],
      workAuthorizationAnswers: (verifiedAnswers.data ?? []).map((answer) => ({
        key: answer.canonical_key,
        booleanValue: answer.boolean_value,
        textValue: answer.text_value,
      })),
    };

    const rows = (jobs.data ?? []).map((job) => {
      const scored = scoreStructuredMatch(
        {
          title: job.title,
          description: job.description ?? "",
          location: job.location,
          country: job.country,
          remoteType: job.remote_type,
          employmentType: job.employment_type,
          seniority: job.seniority,
          salaryMin: job.salary_min == null ? null : Number(job.salary_min),
          salaryMax: job.salary_max == null ? null : Number(job.salary_max),
          salaryCurrency: job.salary_currency,
        },
        candidate,
      );

      return {
        user_id: userId,
        job_id: job.id,
        match_score: scored.matchScore,
        role_score: scored.roleScore,
        skills_score: scored.skillsScore,
        experience_score: scored.experienceScore,
        location_score: scored.locationScore,
        seniority_score: scored.seniorityScore,
        preferences_score: scored.preferencesScore,
        hard_requirements_met: scored.hardRequirementsMet,
        explanation: scored.explanation,
        created_at: new Date().toISOString(),
      };
    });

    if (rows.length) {
      const { supabaseAdmin } = await import(
        "@/integrations/supabase/client.server"
      );
      const { error } = await supabaseAdmin
        .from("job_matches")
        .upsert(rows, { onConflict: "user_id,job_id" });
      if (error) throw new Error(error.message);
    }

    const minimum = Number(pref?.minimum_match_score ?? 70);
    return {
      totalEligibleInventory: rows.length,
      readyCount: rows.filter(
        (row) =>
          row.hard_requirements_met && Number(row.match_score) >= minimum,
      ).length,
      rejectedByHardRequirements: rows.filter(
        (row) => !row.hard_requirements_met,
      ).length,
      minimumMatchScore: minimum,
    };
  });

export const listAvailablePlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("plans")
      .select(
        "code,name,weekly_application_limit,price_amount,price_currency,billing_period,sort_order",
      )
      .eq("active", true)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
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
    if (!Array.isArray(data.jobIds) || data.jobIds.length === 0) {
      throw new Error("Seleccioná al menos un trabajo.");
    }
    return { jobIds: [...new Set(data.jobIds)].slice(0, 500) };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const [{ data: consent }, { data: subscription }, { data: selectedJobs }] =
      await Promise.all([
        supabase
          .from("auto_apply_consents")
          .select("authorized, revoked_at")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("subscriptions")
          .select("status, current_period_start, current_period_end, plans(weekly_application_limit)")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("jobs")
          .select("id, application_schema_id")
          .in("id", data.jobIds)
          .eq("auto_apply_eligible", true)
          .eq("is_active", true),
      ]);

    if (!consent?.authorized || consent.revoked_at) {
      return {
        status: "consent_required" as const,
        batchId: null,
        results: {},
      };
    }

    if (subscription?.status !== "active") {
      return {
        status: "subscription_required" as const,
        batchId: null,
        results: {},
      };
    }

    const jobs = selectedJobs ?? [];
    const allowedIds = new Set(jobs.map((job) => job.id));
    const unavailable = data.jobIds.filter((jobId) => !allowedIds.has(jobId));
    if (unavailable.length) {
      return {
        status: "jobs_unavailable" as const,
        batchId: null,
        results: { unavailable: unavailable.length },
      };
    }

    const readiness = await applicationReadiness(supabase, userId, jobs);
    const missingAnswers = jobs.filter(
      (job) => (readiness.get(job.id) ?? []).length > 0,
    );
    if (missingAnswers.length) {
      return {
        status: "answers_required" as const,
        batchId: null,
        results: { answers_required: missingAnswers.length },
      };
    }

    const minimumMatch = await supabase
      .from("job_preferences")
      .select("minimum_match_score")
      .eq("user_id", userId)
      .maybeSingle();
    const minimum = Number(minimumMatch.data?.minimum_match_score ?? 70);
    const { data: selectedMatches } = await supabase
      .from("job_matches")
      .select("job_id, match_score, hard_requirements_met")
      .eq("user_id", userId)
      .in("job_id", data.jobIds);

    const qualifiedIds = new Set(
      (selectedMatches ?? [])
        .filter(
          (match) =>
            match.hard_requirements_met &&
            Number(match.match_score) >= minimum,
        )
        .map((match) => match.job_id),
    );
    if (qualifiedIds.size !== data.jobIds.length) {
      return {
        status: "jobs_unavailable" as const,
        batchId: null,
        results: { below_match_threshold: data.jobIds.length - qualifiedIds.size },
      };
    }

    const weeklyLimit =
      subscription.plans?.weekly_application_limit ?? null;
    if (weeklyLimit != null) {
      const now = new Date();
      const periodStart =
        subscription.current_period_start ??
        new Date(
          Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate() - ((now.getUTCDay() + 6) % 7),
          ),
        ).toISOString();
      const periodEnd =
        subscription.current_period_end ??
        new Date(new Date(periodStart).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const [{ data: credits }, { count: outstanding }] = await Promise.all([
        supabase
          .from("application_credits")
          .select("consumed")
          .eq("user_id", userId)
          .gte("period_start", periodStart.slice(0, 10))
          .lt("period_start", periodEnd.slice(0, 10)),
        supabase
          .from("application_attempts")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .gte("queued_at", periodStart)
          .lt("queued_at", periodEnd)
          .in("status", [
            "queued",
            "preparing",
            "resume_generating",
            "ready",
            "submitting",
            "submitted_unverified",
            "failed_retryable",
          ]),
      ]);

      const consumed = (credits ?? []).reduce(
        (total, row) => total + (row.consumed ?? 0),
        0,
      );
      const remaining = Math.max(
        weeklyLimit - consumed - (outstanding ?? 0),
        0,
      );

      if (data.jobIds.length > remaining) {
        return {
          status: "limit_exceeded" as const,
          batchId: null,
          results: {
            requested: data.jobIds.length,
            remaining,
            weekly_limit: weeklyLimit,
          },
        };
      }
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: batch, error: batchError } = await supabaseAdmin
      .from("application_batches")
      .insert({
        user_id: userId,
        total_selected: data.jobIds.length,
        status: "open",
      })
      .select("id")
      .single();
    if (batchError) throw new Error(batchError.message);

    const results: Record<string, number> = {};
    for (const jobId of data.jobIds) {
      const { data: outcome } = await supabaseAdmin.rpc(
        "enqueue_application",
        {
          _user_id: userId,
          _job_id: jobId,
          _batch_id: batch.id,
          _priority: 100,
        },
      );
      const key = (outcome as string) ?? "error";
      results[key] = (results[key] ?? 0) + 1;
    }

    const queuedCount = results["queued"] ?? 0;
    if (queuedCount === 0) {
      await supabaseAdmin
        .from("application_batches")
        .delete()
        .eq("id", batch.id)
        .eq("user_id", userId);

      if ((results["limit_reached"] ?? 0) > 0) {
        return {
          status: "limit_exceeded" as const,
          batchId: null,
          results,
        };
      }

      return {
        status: "jobs_unavailable" as const,
        batchId: null,
        results,
      };
    }

    if (queuedCount !== data.jobIds.length) {
      await supabaseAdmin
        .from("application_batches")
        .update({ total_selected: queuedCount })
        .eq("id", batch.id)
        .eq("user_id", userId);
    }

    return {
      status: "queued" as const,
      batchId: batch.id,
      results,
    };
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
