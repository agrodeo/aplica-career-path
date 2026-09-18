import { createServerFn } from "@tanstack/react-start";
import type { Json } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CareerVoice = "direct" | "ambitious" | "technical" | "balanced";

export type RichOnboardingPayload = {
  identity: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    country: string;
    city: string;
    currentTitle: string;
  };
  experiences: Array<{
    company: string;
    title: string;
    start: string;
    end: string;
    description: string;
    achievements: string;
  }>;
  education: {
    institution: string;
    degree: string;
    field: string;
    studyDates: string;
  } | null;
  skills: string[];
  languages: { language: string; level: string }[];
  careerContext: {
    responsibilities: string[];
    tools: string[];
    results: string[];
    preferredTasks: string[];
    avoidTasks: string[];
    strengths: string[];
    differentiators: string[];
    proudProject: string;
    challengeStory: string;
    careerGoal: string;
    targetEnvironment: string;
    availability: string;
    travelPreference: string;
  };
  writingPreferences: {
    voice: CareerVoice;
    emphasis: string[];
    deEmphasis: string[];
    summaryStyle: string;
  };
  preferences: {
    targetRoles: string[];
    targetLocations: string[];
    modes: string[];
    employmentTypes: string[];
    seniorityLevels: string[];
    willingToRelocate: boolean;
    internationalRemote: boolean;
    minimumSalary: number | null;
    salaryCurrency: string | null;
    salaryPeriod: string | null;
    preferredIndustries: string[];
    dealbreakers: string[];
    minimumMatchScore: number;
  };
  sensitiveAnswers: {
    workAuthorization: boolean | null;
    sponsorship: boolean | null;
  };
  links: {
    linkedin: string;
    portfolio: string;
  };
  baseResumePath: string | null;
  authorizeAutoApply: boolean;
};

const clean = (value: string, max = 500) => value.trim().slice(0, max);
const cleanList = (values: string[], maxItems = 30, maxLength = 240) =>
  [...new Set(values.map((value) => clean(value, maxLength)).filter(Boolean))].slice(
    0,
    maxItems,
  );

function parseMonthDate(value: string): string | null {
  const raw = value.trim();
  if (!raw || /actual|presente|present|current|hoy/i.test(raw)) return null;

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return raw;

  const yearOnly = raw.match(/^(19|20)\d{2}$/);
  if (yearOnly) return `${raw}-01-01`;

  const numeric = raw.match(/^(\d{1,2})[\/-](\d{4})$/);
  if (numeric) {
    const month = Math.max(1, Math.min(12, Number(numeric[1])));
    return `${numeric[2]}-${String(month).padStart(2, "0")}-01`;
  }

  const months: Record<string, number> = {
    jan: 1,
    ene: 1,
    feb: 2,
    mar: 3,
    apr: 4,
    abr: 4,
    may: 5,
    jun: 6,
    jul: 7,
    aug: 8,
    ago: 8,
    sep: 9,
    sept: 9,
    oct: 10,
    nov: 11,
    dec: 12,
    dic: 12,
  };

  const named = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .match(/^([a-z]{3,9})\.?\s+(\d{4})$/);
  if (named) {
    const key = named[1].slice(0, 4);
    const month = months[key] ?? months[key.slice(0, 3)] ?? null;
    if (month) return `${named[2]}-${String(month).padStart(2, "0")}-01`;
  }
  return null;
}

function parseStudyRange(value: string) {
  const parts = value
    .split(/\s*(?:—|–|-| a | to | hasta )\s*/i)
    .filter(Boolean);
  return {
    startDate: parseMonthDate(parts[0] ?? ""),
    endDate: parseMonthDate(parts[1] ?? ""),
    isCurrent: /actual|presente|present|current|hoy/i.test(parts[1] ?? ""),
  };
}

function modeFlags(modes: string[]) {
  const lower = modes.map((mode) => mode.toLowerCase());
  return {
    remote: lower.some((mode) => /remote|remoto/.test(mode)),
    hybrid: lower.some((mode) => /hybrid|hibr|híbr/.test(mode)),
    onsite: lower.some((mode) => /onsite|presencial|office/.test(mode)),
  };
}

export const saveOnboardingDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { step: number; state: Record<string, unknown> }) => {
    const serialized = JSON.stringify(data.state);
    if (serialized.length > 120_000) {
      throw new Error("El borrador es demasiado grande.");
    }
    return {
      step: Math.max(1, Math.min(40, Math.floor(data.step))),
      state: data.state as Json,
    };
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("onboarding_drafts").upsert(
      {
        user_id: context.userId,
        last_step: data.step,
        state: data.state,
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getOnboardingSeed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [
      authUser,
      profile,
      experience,
      education,
      skills,
      languages,
      preferences,
      answers,
      consent,
      careerContext,
      writingPreferences,
      draft,
    ] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase
        .from("experiences")
        .select("*")
        .eq("user_id", userId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("educations")
        .select("*")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle(),
      supabase.from("skills").select("name").eq("user_id", userId),
      supabase.from("languages").select("language, level").eq("user_id", userId),
      supabase
        .from("job_preferences")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("application_answers")
        .select("canonical_key, boolean_value, user_confirmed")
        .eq("user_id", userId)
        .in("canonical_key", ["work_authorization", "sponsorship"]),
      supabase
        .from("auto_apply_consents")
        .select("authorized, revoked_at")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("career_contexts")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("writing_preferences")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("onboarding_drafts")
        .select("last_step,state")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    const workAuthorization = answers.data?.find(
      (answer) => answer.canonical_key === "work_authorization",
    );
    const sponsorship = answers.data?.find(
      (answer) => answer.canonical_key === "sponsorship",
    );
    const pref = preferences.data;
    const contextRow = careerContext.data;

    return {
      identity: {
        firstName:
          profile.data?.first_name ??
          String(authUser.data.user?.user_metadata?.["first_name"] ?? ""),
        lastName: profile.data?.last_name ?? "",
        email: profile.data?.email ?? authUser.data.user?.email ?? "",
        phone: profile.data?.phone ?? "",
        country: profile.data?.country ?? "",
        city: profile.data?.city ?? "",
        currentTitle: profile.data?.current_title ?? "",
      },
      links: {
        linkedin: profile.data?.linkedin_url ?? "",
        portfolio: profile.data?.portfolio_url ?? "",
      },
      experiences: (experience.data ?? []).map((item) => ({
        company: item.company,
        title: item.title,
        start: item.start_date ?? "",
        end: item.is_current ? "Actualidad" : item.end_date ?? "",
        description: item.description ?? "",
        achievements: Array.isArray(item.achievements)
          ? (item.achievements as string[]).join("\n")
          : "",
      })),
      // Transitional convenience for older UI code; always points to the
      // highest-priority experience.
      experience: experience.data?.[0]
        ? {
            company: experience.data[0].company,
            title: experience.data[0].title,
            start: experience.data[0].start_date ?? "",
            end: experience.data[0].is_current
              ? "Actualidad"
              : experience.data[0].end_date ?? "",
            description: experience.data[0].description ?? "",
            achievements: Array.isArray(experience.data[0].achievements)
              ? (experience.data[0].achievements as string[]).join("\n")
              : "",
          }
        : null,
      education: education.data
        ? {
            institution: education.data.institution,
            degree: education.data.degree ?? "",
            field: education.data.field ?? "",
            studyDates: [
              education.data.start_date?.slice(0, 4),
              education.data.is_current
                ? "Actualidad"
                : education.data.end_date?.slice(0, 4),
            ]
              .filter(Boolean)
              .join(" — "),
          }
        : null,
      skills: (skills.data ?? []).map((skill) => skill.name),
      languages: languages.data ?? [],
      careerContext: {
        responsibilities: contextRow?.responsibilities ?? [],
        tools: contextRow?.tools ?? [],
        results: contextRow?.results ?? [],
        preferredTasks: contextRow?.preferred_tasks ?? [],
        avoidTasks: contextRow?.avoid_tasks ?? [],
        strengths: contextRow?.strengths ?? [],
        differentiators: contextRow?.differentiators ?? [],
        proudProject: contextRow?.proud_project ?? "",
        challengeStory: contextRow?.challenge_story ?? "",
        careerGoal: contextRow?.career_goal ?? "",
        targetEnvironment: contextRow?.target_environment ?? "",
        availability: contextRow?.availability ?? "",
        travelPreference: contextRow?.travel_preference ?? "",
      },
      writingPreferences: {
        voice: (writingPreferences.data?.voice ?? "balanced") as CareerVoice,
        emphasis: writingPreferences.data?.emphasis ?? [],
        deEmphasis: writingPreferences.data?.de_emphasis ?? [],
        summaryStyle: writingPreferences.data?.summary_style ?? "concise",
      },
      preferences: pref
        ? {
            targetRoles: pref.target_roles,
            targetLocations: pref.target_locations,
            modes: [
              pref.remote_allowed ? "Remoto" : null,
              pref.hybrid_allowed ? "Híbrido" : null,
              pref.onsite_allowed ? "Presencial" : null,
            ].filter(Boolean) as string[],
            employmentTypes: pref.employment_types,
            seniorityLevels: pref.seniority_levels,
            willingToRelocate: pref.willing_to_relocate,
            internationalRemote: pref.international_remote,
            minimumSalary: pref.minimum_salary,
            salaryCurrency: pref.salary_currency,
            salaryPeriod: pref.salary_period,
            preferredIndustries: pref.preferred_industries,
            minimumMatchScore: Number(pref.minimum_match_score),
          }
        : null,
      sensitiveAnswers: {
        workAuthorization: workAuthorization?.user_confirmed
          ? workAuthorization.boolean_value
          : null,
        sponsorship: sponsorship?.user_confirmed
          ? sponsorship.boolean_value
          : null,
      },
      baseResumePath: profile.data?.base_resume_path ?? null,
      authorizeAutoApply:
        consent.data?.authorized === true && !consent.data?.revoked_at,
      draft: draft.data
        ? {
            step: draft.data.last_step,
            state: draft.data.state,
          }
        : null,
    };
  });

function factRows(
  userId: string,
  data: RichOnboardingPayload,
  savedExperiences: Array<{ id: string; sortOrder: number }>,
) {
  const rows: Array<{
    user_id: string;
    fact_type: string;
    claim: string;
    source_type: string;
    source_ref: string | null;
    user_confirmed: boolean;
    allowed_for_resume: boolean;
    confidence: number;
    metadata: Json;
  }> = [];

  const add = (
    factType: string,
    claim: string,
    section: string,
    allowedForResume = true,
    sourceRef: string | null = null,
  ) => {
    const cleaned = clean(claim, 2000);
    if (!cleaned) return;
    rows.push({
      user_id: userId,
      fact_type: factType,
      claim: cleaned,
      source_type: "onboarding",
      source_ref: sourceRef,
      user_confirmed: true,
      allowed_for_resume: allowedForResume,
      confidence: 1,
      metadata: { section } as Json,
    });
  };

  // Experience-specific facts can support bullets for that experience.
  for (const responsibility of data.careerContext.responsibilities) {
    add(
      "responsibility",
      responsibility,
      "experience",
      true,
      savedExperiences[0]?.id ?? null,
    );
  }
  for (const result of data.careerContext.results) {
    add("achievement", result, "results", true, savedExperiences[0]?.id ?? null);
  }
  for (const tool of data.careerContext.tools) {
    add("tool", tool, "tools", true, savedExperiences[0]?.id ?? null);
  }

  // Explicit skills are globally usable resume facts, but not tied to one job.
  for (const skill of data.skills) {
    add("skill", skill, "skills", true, null);
  }

  // Self-positioning is valuable context for selection and narrative answers,
  // but must not silently become a factual resume claim.
  for (const strength of data.careerContext.strengths) {
    add("strength", strength, "strengths", false, null);
  }
  for (const differentiator of data.careerContext.differentiators) {
    add("differentiator", differentiator, "positioning", false, null);
  }

  data.experiences.forEach((experience, index) => {
    const sourceRef =
      savedExperiences.find((saved) => saved.sortOrder === index)?.id ?? null;
    add(
      "experience_description",
      experience.description,
      "experience",
      true,
      sourceRef,
    );
    for (const achievement of experience.achievements.split(/\n|;/)) {
      add("achievement", achievement, "experience", true, sourceRef);
    }
  });

  // Project/challenge/career-goal stories stay available to application answers
  // but are not resume claims unless we later ask the user to bind them to an
  // experience/project record explicitly.
  add("project", data.careerContext.proudProject, "story", false, null);
  add("career_goal", data.careerContext.careerGoal, "career_goal", false, null);
  add("challenge_story", data.careerContext.challengeStory, "story", false, null);
  return rows.slice(0, 120);
}

export const saveOnboardingProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: RichOnboardingPayload) => {
    if (!data.identity.email.trim()) throw new Error("Ingresá tu email.");
    if (!data.identity.firstName.trim()) throw new Error("Ingresá tu nombre.");
    if (!data.preferences.targetRoles.length) {
      throw new Error("Elegí al menos un puesto objetivo.");
    }
    if (!data.authorizeAutoApply) {
      throw new Error(
        "Necesitamos tu autorización explícita para enviar postulaciones seleccionadas por vos.",
      );
    }
    if (
      !["direct", "ambitious", "technical", "balanced"].includes(
        data.writingPreferences.voice,
      )
    ) {
      throw new Error("Elegí cómo querés que Aplica te presente.");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [
      { data: existingProfile },
      { data: existingEducation },
      { data: existingLanguages },
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("master_profile_version")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("educations")
        .select("id")
        .eq("user_id", userId)
        .order("start_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("languages")
        .select("id, language")
        .eq("user_id", userId),
    ]);

    const nextVersion = (existingProfile?.master_profile_version ?? 0) + 1;
    const identity = data.identity;

    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        user_id: userId,
        first_name: clean(identity.firstName, 120) || null,
        last_name: clean(identity.lastName, 120) || null,
        email: clean(identity.email, 320) || null,
        phone: clean(identity.phone, 80) || null,
        whatsapp: clean(identity.phone, 80) || null,
        country: clean(identity.country, 120) || null,
        city: clean(identity.city, 160) || null,
        current_title: clean(identity.currentTitle, 180) || null,
        linkedin_url: clean(data.links.linkedin, 500) || null,
        portfolio_url: clean(data.links.portfolio, 500) || null,
        base_resume_path: data.baseResumePath,
        master_profile_version: nextVersion,
      },
      { onConflict: "user_id" },
    );
    if (profileError) throw new Error(profileError.message);

    const { error: deleteExperiencesError } = await supabase
      .from("experiences")
      .delete()
      .eq("user_id", userId);
    if (deleteExperiencesError) throw new Error(deleteExperiencesError.message);

    const normalizedExperiences = data.experiences
      .map((experience, index) => {
        if (!experience.company.trim() || !experience.title.trim()) return null;
        const endText = experience.end.trim();
        return {
          user_id: userId,
          company: clean(experience.company, 220),
          title: clean(experience.title, 220),
          start_date: parseMonthDate(experience.start),
          end_date: parseMonthDate(experience.end),
          is_current: /actual|presente|present|current|hoy/i.test(endText),
          description: clean(experience.description, 5000) || null,
          achievements: experience.achievements
            .split(/\n|;/)
            .map((achievement) => clean(achievement, 1000))
            .filter(Boolean)
            .slice(0, 20),
          source: data.baseResumePath ? "cv_parse" : "manual",
          verified_by_user: true,
          sort_order: index,
        };
      })
      .filter((experience): experience is NonNullable<typeof experience> =>
        Boolean(experience),
      )
      .slice(0, 30);

    const savedExperiences: Array<{ id: string; sortOrder: number }> = [];
    if (normalizedExperiences.length) {
      const { data: inserted, error } = await supabase
        .from("experiences")
        .insert(normalizedExperiences)
        .select("id, sort_order");
      if (error) throw new Error(error.message);
      for (const row of inserted ?? []) {
        savedExperiences.push({ id: row.id, sortOrder: row.sort_order });
      }
    }

    if (data.education?.institution.trim()) {
      const range = parseStudyRange(data.education.studyDates);
      const educationPayload = {
        institution: clean(data.education.institution, 260),
        degree: clean(data.education.degree, 260) || null,
        field: clean(data.education.field, 260) || null,
        start_date: range.startDate,
        end_date: range.endDate,
        is_current: range.isCurrent,
        verified_by_user: true,
      };

      const { error } = existingEducation
        ? await supabase
            .from("educations")
            .update(educationPayload)
            .eq("id", existingEducation.id)
            .eq("user_id", userId)
        : await supabase
            .from("educations")
            .insert({ user_id: userId, ...educationPayload });
      if (error) throw new Error(error.message);
    }

    const uniqueSkills = cleanList(data.skills, 50, 120);
    const { error: deleteSkillsError } = await supabase
      .from("skills")
      .delete()
      .eq("user_id", userId);
    if (deleteSkillsError) throw new Error(deleteSkillsError.message);
    if (uniqueSkills.length) {
      const { error } = await supabase.from("skills").insert(
        uniqueSkills.map((name) => ({
          user_id: userId,
          name,
          verified_by_user: true,
        })),
      );
      if (error) throw new Error(error.message);
    }

    const uniqueLanguages = data.languages
      .filter((language) => language.language.trim() && language.level.trim())
      .filter(
        (language, index, rows) =>
          rows.findIndex(
            (candidate) =>
              candidate.language.trim().toLowerCase() ===
              language.language.trim().toLowerCase(),
          ) === index,
      )
      .slice(0, 12);

    for (const language of uniqueLanguages) {
      const existing = (existingLanguages ?? []).find(
        (row) =>
          row.language.trim().toLowerCase() ===
          language.language.trim().toLowerCase(),
      );
      const payload = {
        language: clean(language.language, 120),
        level: clean(language.level, 80),
      };
      const { error } = existing
        ? await supabase
            .from("languages")
            .update(payload)
            .eq("id", existing.id)
            .eq("user_id", userId)
        : await supabase
            .from("languages")
            .insert({ user_id: userId, ...payload });
      if (error) throw new Error(error.message);
    }

    const modes = modeFlags(data.preferences.modes);
    const { error: preferencesError } = await supabase
      .from("job_preferences")
      .upsert(
        {
          user_id: userId,
          target_roles: cleanList(data.preferences.targetRoles, 12, 180),
          target_locations: cleanList(
            data.preferences.targetLocations,
            12,
            180,
          ),
          remote_allowed: modes.remote,
          hybrid_allowed: modes.hybrid,
          onsite_allowed: modes.onsite,
          employment_types: cleanList(
            data.preferences.employmentTypes,
            12,
            80,
          ),
          minimum_salary: data.preferences.minimumSalary,
          salary_currency: data.preferences.salaryCurrency
            ? clean(data.preferences.salaryCurrency, 12)
            : null,
          salary_period: data.preferences.salaryPeriod
            ? clean(data.preferences.salaryPeriod, 40)
            : null,
          seniority_levels: cleanList(
            data.preferences.seniorityLevels,
            12,
            80,
          ),
          willing_to_relocate: data.preferences.willingToRelocate,
          international_remote: data.preferences.internationalRemote,
          preferred_industries: cleanList(
            data.preferences.preferredIndustries,
            30,
            120,
          ),
          excluded_companies: [],
          excluded_industries: [],
          minimum_match_score: Math.max(
            0,
            Math.min(100, data.preferences.minimumMatchScore),
          ),
        },
        { onConflict: "user_id" },
      );
    if (preferencesError) throw new Error(preferencesError.message);

    const contextPayload = {
      user_id: userId,
      preferred_tasks: cleanList(data.careerContext.preferredTasks),
      avoid_tasks: cleanList(data.careerContext.avoidTasks),
      strengths: cleanList(data.careerContext.strengths),
      differentiators: cleanList(data.careerContext.differentiators),
      tools: cleanList(data.careerContext.tools, 50, 120),
      responsibilities: cleanList(
        data.careerContext.responsibilities,
        50,
        500,
      ),
      results: cleanList(data.careerContext.results, 40, 1000),
      proud_project: clean(data.careerContext.proudProject, 4000) || null,
      challenge_story: clean(data.careerContext.challengeStory, 4000) || null,
      career_goal: clean(data.careerContext.careerGoal, 2000) || null,
      target_environment:
        clean(data.careerContext.targetEnvironment, 1000) || null,
      availability: clean(data.careerContext.availability, 300) || null,
      travel_preference:
        clean(data.careerContext.travelPreference, 300) || null,
    };
    const { error: contextError } = await supabase
      .from("career_contexts")
      .upsert(contextPayload, { onConflict: "user_id" });
    if (contextError) throw new Error(contextError.message);

    const { error: writingError } = await supabase
      .from("writing_preferences")
      .upsert(
        {
          user_id: userId,
          voice: data.writingPreferences.voice,
          emphasis: cleanList(data.writingPreferences.emphasis, 20, 120),
          de_emphasis: cleanList(
            data.writingPreferences.deEmphasis,
            20,
            120,
          ),
          summary_style:
            clean(data.writingPreferences.summaryStyle, 80) || "concise",
        },
        { onConflict: "user_id" },
      );
    if (writingError) throw new Error(writingError.message);

    const answerKeys = ["work_authorization", "sponsorship"];
    const { error: deleteAnswersError } = await supabase
      .from("application_answers")
      .delete()
      .eq("user_id", userId)
      .in("canonical_key", answerKeys);
    if (deleteAnswersError) throw new Error(deleteAnswersError.message);

    const answers = [
      ["work_authorization", data.sensitiveAnswers.workAuthorization],
      ["sponsorship", data.sensitiveAnswers.sponsorship],
    ] as const;
    const answerRows = answers
      .filter(
        (answer): answer is readonly [string, boolean] => answer[1] !== null,
      )
      .map(([canonicalKey, value]) => ({
        user_id: userId,
        canonical_key: canonicalKey,
        answer_type: "boolean",
        boolean_value: value,
        text_value: null,
        numeric_value: null,
        user_confirmed: true,
      }));
    if (answerRows.length) {
      const { error } = await supabase
        .from("application_answers")
        .insert(answerRows);
      if (error) throw new Error(error.message);
    }

    const { error: deleteFactsError } = await supabase
      .from("fact_ledger")
      .delete()
      .eq("user_id", userId)
      .eq("source_type", "onboarding");
    if (deleteFactsError) throw new Error(deleteFactsError.message);

    const facts = factRows(userId, data, savedExperiences);
    if (facts.length) {
      const { error } = await supabase.from("fact_ledger").insert(facts);
      if (error) throw new Error(error.message);
    }

    const now = new Date().toISOString();
    const { error: consentError } = await supabase
      .from("auto_apply_consents")
      .upsert(
        {
          user_id: userId,
          authorized: data.authorizeAutoApply,
          authorized_at: data.authorizeAutoApply ? now : null,
          revoked_at: data.authorizeAutoApply ? null : now,
          terms_version: "v1",
        },
        { onConflict: "user_id" },
      );
    if (consentError) throw new Error(consentError.message);

    await supabase
      .from("onboarding_drafts")
      .delete()
      .eq("user_id", userId);

    return {
      ok: true,
      masterProfileVersion: nextVersion,
      factCount: facts.length,
      dealbreakers: data.preferences.dealbreakers,
    };
  });
