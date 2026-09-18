import type { WorkerDb } from "./worker-api.server";

/**
 * Builds the single processing payload for one claimed application.
 * This is the ONLY way the worker receives personal data: scoped to one user,
 * one job, one attempt. There is no bulk export path anywhere in the contract.
 */
export async function buildApplicationPayload(db: WorkerDb, queue: { id: string; user_id: string; job_id: string; attempt_id: string; batch_id: string | null; attempts: number }) {
  const userId = queue.user_id;

  const [
    job,
    profile,
    experiences,
    educations,
    skills,
    languages,
    answers,
    preferences,
    consent,
    subscription,
    credits,
    careerContext,
    writingPreferences,
    facts,
  ] = await Promise.all([
    db
      .from("jobs")
      .select(
        "id, title, description, location, country, remote_type, employment_type, seniority, application_url, ats_type, auto_apply_adapter, auto_apply_eligible, is_active, submission_mechanism, application_schema_id, company_id",
      )
      .eq("id", queue.job_id)
      .maybeSingle(),
    db.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
    db.from("experiences").select("*").eq("user_id", userId).order("start_date", { ascending: false }),
    db.from("educations").select("*").eq("user_id", userId),
    db.from("skills").select("*").eq("user_id", userId),
    db.from("languages").select("*").eq("user_id", userId),
    db.from("application_answers").select("canonical_key, answer_type, boolean_value, text_value, numeric_value, user_confirmed").eq("user_id", userId),
    db.from("job_preferences").select("*").eq("user_id", userId).maybeSingle(),
    db.from("auto_apply_consents").select("authorized, authorized_at, terms_version, revoked_at").eq("user_id", userId).maybeSingle(),
    db.from("subscriptions").select("plan_code, status, current_period_start, current_period_end").eq("user_id", userId).maybeSingle(),
    db.from("application_credits").select("granted, consumed, period_start, period_end").eq("user_id", userId).order("period_start", { ascending: false }).limit(1),
    db.from("career_contexts").select("*").eq("user_id", userId).maybeSingle(),
    db.from("writing_preferences").select("*").eq("user_id", userId).maybeSingle(),
    db
      .from("fact_ledger")
      .select("id,fact_type,claim,source_type,source_ref,user_confirmed,allowed_for_resume,confidence")
      .eq("user_id", userId)
      .eq("user_confirmed", true)
      .eq("allowed_for_resume", true),
  ]);

  const jobRow = job.data;
  const profileRow = profile.data;
  if (!jobRow) return { error: "job_not_found" as const };
  if (!profileRow) return { error: "profile_missing" as const };

  const company = jobRow.company_id ? await db.from("companies").select("id, name, website, careers_url, ats_type, ats_identifier").eq("id", jobRow.company_id).maybeSingle() : null;
  const schema = jobRow.application_schema_id ? await db.from("application_schemas").select("*").eq("id", jobRow.application_schema_id).maybeSingle() : null;
  const adapterName = jobRow.auto_apply_adapter;
  const adapter = adapterName ? await db.from("adapter_registry").select("*").eq("adapter", adapterName).maybeSingle() : null;

  const latestCredits = credits.data?.[0];
  const creditsAvailable = latestCredits ? Math.max((latestCredits.granted ?? 0) - (latestCredits.consumed ?? 0), 0) : 0;

  return {
    application_attempt_id: queue.attempt_id,
    queue_id: queue.id,
    attempt_number: queue.attempts,
    batch_id: queue.batch_id,
    job: {
      id: jobRow.id,
      title: jobRow.title,
      description: jobRow.description ?? "",
      location: jobRow.location,
      country: jobRow.country,
      remote_type: jobRow.remote_type,
      employment_type: jobRow.employment_type,
      seniority: jobRow.seniority,
      application_url: jobRow.application_url,
      ats_type: jobRow.ats_type,
      adapter: adapterName,
      submission_mechanism: jobRow.submission_mechanism,
      auto_apply_eligible: jobRow.auto_apply_eligible,
      is_active: jobRow.is_active,
    },
    company: company?.data ?? null,
    application_schema: schema?.data ?? null,
    adapter_metadata: adapter?.data ?? null,
    master_profile: {
      userId,
      masterProfileVersion: profileRow.master_profile_version ?? 1,
      identity: {
        firstName: profileRow.first_name ?? "",
        lastName: profileRow.last_name ?? "",
        email: profileRow.email ?? "",
        phone: profileRow.phone ?? "",
        city: profileRow.city ?? "",
        country: profileRow.country ?? "",
        currentTitle: profileRow.current_title ?? "",
        professionalSummary: profileRow.professional_summary ?? "",
      },
      experience: (experiences.data ?? []).map((e) => ({
        id: e.id,
        company: e.company,
        title: e.title,
        startDate: e.start_date,
        endDate: e.end_date,
        isCurrent: e.is_current,
        description: e.description ?? "",
        achievements: Array.isArray(e.achievements) ? (e.achievements as string[]) : [],
      })),
      education: (educations.data ?? []).map((e) => ({ id: e.id, institution: e.institution, degree: e.degree ?? "", field: e.field ?? "", startDate: e.start_date, endDate: e.end_date })),
      skills: (skills.data ?? []).map((s) => ({ id: s.id, name: s.name })),
      languages: (languages.data ?? []).map((l) => ({ language: l.language, level: l.level })),
      links: { linkedin: profileRow.linkedin_url ?? "", portfolio: profileRow.portfolio_url ?? "" },
      careerContext: {
        preferredTasks: careerContext.data?.preferred_tasks ?? [],
        avoidTasks: careerContext.data?.avoid_tasks ?? [],
        strengths: careerContext.data?.strengths ?? [],
        differentiators: careerContext.data?.differentiators ?? [],
        tools: careerContext.data?.tools ?? [],
        responsibilities: careerContext.data?.responsibilities ?? [],
        results: careerContext.data?.results ?? [],
        proudProject: careerContext.data?.proud_project ?? "",
        challengeStory: careerContext.data?.challenge_story ?? "",
        careerGoal: careerContext.data?.career_goal ?? "",
        targetEnvironment: careerContext.data?.target_environment ?? "",
        availability: careerContext.data?.availability ?? "",
        travelPreference: careerContext.data?.travel_preference ?? "",
      },
      writingPreferences: {
        voice: writingPreferences.data?.voice ?? "balanced",
        emphasis: writingPreferences.data?.emphasis ?? [],
        deEmphasis: writingPreferences.data?.de_emphasis ?? [],
        summaryStyle: writingPreferences.data?.summary_style ?? "concise",
      },
      facts: (facts.data ?? []).map((fact) => ({
        id: fact.id,
        factType: fact.fact_type,
        claim: fact.claim,
        sourceType: fact.source_type,
        sourceRef: fact.source_ref,
        userConfirmed: fact.user_confirmed,
        allowedForResume: fact.allowed_for_resume,
        confidence: Number(fact.confidence),
      })),
    },
    verified_answers: (answers.data ?? []).map((a) => ({
      canonicalKey: a.canonical_key,
      answerType: a.answer_type,
      booleanValue: a.boolean_value,
      textValue: a.text_value,
      numericValue: a.numeric_value,
      userConfirmed: a.user_confirmed,
    })),
    preferences: preferences.data ?? null,
    consent: consent.data ?? null,
    subscription: {
      plan_code: subscription.data?.plan_code ?? null,
      status: subscription.data?.status ?? null,
      credits_available: creditsAvailable,
    },
  };
}
