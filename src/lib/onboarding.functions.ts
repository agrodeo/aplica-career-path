import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type OnboardingPayload = {
  identity: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    country: string;
    city: string;
    currentTitle: string;
  };
  experience: {
    company: string;
    title: string;
    start: string;
    end: string;
    description: string;
    achievements: string;
  } | null;
  education: {
    institution: string;
    degree: string;
    field: string;
    studyDates: string;
  } | null;
  skills: string[];
  languages: { language: string; level: string }[];
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
  baseResumePath: string | null;
  authorizeAutoApply: boolean;
};

const clean = (value: string, max = 500) => value.trim().slice(0, max);

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
    const month =
      months[key] ??
      months[key.slice(0, 3)] ??
      null;
    if (month) return `${named[2]}-${String(month).padStart(2, "0")}-01`;
  }

  return null;
}

function parseStudyRange(value: string) {
  const parts = value.split(/\s*(?:—|–|-| a | to | hasta )\s*/i).filter(Boolean);
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

export const getOnboardingSeed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [profile, experience, education, skills, languages, preferences, answers, consent] =
      await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("experiences").select("*").eq("user_id", userId).order("sort_order").limit(1).maybeSingle(),
        supabase.from("educations").select("*").eq("user_id", userId).limit(1).maybeSingle(),
        supabase.from("skills").select("name").eq("user_id", userId),
        supabase.from("languages").select("language, level").eq("user_id", userId),
        supabase.from("job_preferences").select("*").eq("user_id", userId).maybeSingle(),
        supabase
          .from("application_answers")
          .select("canonical_key, boolean_value, user_confirmed")
          .eq("user_id", userId)
          .in("canonical_key", ["work_authorization", "sponsorship"]),
        supabase.from("auto_apply_consents").select("authorized, revoked_at").eq("user_id", userId).maybeSingle(),
      ]);

    const workAuthorization = answers.data?.find((answer) => answer.canonical_key === "work_authorization");
    const sponsorship = answers.data?.find((answer) => answer.canonical_key === "sponsorship");
    const pref = preferences.data;

    return {
      identity: {
        firstName: profile.data?.first_name ?? "",
        lastName: profile.data?.last_name ?? "",
        email: profile.data?.email ?? "",
        phone: profile.data?.phone ?? "",
        country: profile.data?.country ?? "",
        city: profile.data?.city ?? "",
        currentTitle: profile.data?.current_title ?? "",
      },
      experience: experience.data
        ? {
            company: experience.data.company,
            title: experience.data.title,
            start: experience.data.start_date ?? "",
            end: experience.data.is_current ? "Actualidad" : experience.data.end_date ?? "",
            description: experience.data.description ?? "",
            achievements: Array.isArray(experience.data.achievements)
              ? (experience.data.achievements as string[]).join("\n")
              : "",
          }
        : null,
      education: education.data
        ? {
            institution: education.data.institution,
            degree: education.data.degree ?? "",
            field: education.data.field ?? "",
            studyDates: [education.data.start_date?.slice(0, 4), education.data.is_current ? "Actualidad" : education.data.end_date?.slice(0, 4)]
              .filter(Boolean)
              .join(" — "),
          }
        : null,
      skills: (skills.data ?? []).map((skill) => skill.name),
      languages: languages.data ?? [],
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
        workAuthorization:
          workAuthorization?.user_confirmed ? workAuthorization.boolean_value : null,
        sponsorship: sponsorship?.user_confirmed ? sponsorship.boolean_value : null,
      },
      baseResumePath: profile.data?.base_resume_path ?? null,
      authorizeAutoApply:
        consent.data?.authorized === true && !consent.data?.revoked_at,
    };
  });

export const saveOnboardingProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: OnboardingPayload) => {
    if (!data.identity.email.trim()) throw new Error("Ingresá tu email.");
    if (!data.identity.firstName.trim()) throw new Error("Ingresá tu nombre.");
    if (!data.preferences.targetRoles.length) throw new Error("Elegí al menos un puesto objetivo.");
    if (!data.authorizeAutoApply) {
      throw new Error("Necesitamos tu autorización explícita para enviar postulaciones seleccionadas por vos.");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("master_profile_version")
      .eq("user_id", userId)
      .maybeSingle();
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
        base_resume_path: data.baseResumePath,
        master_profile_version: nextVersion,
      },
      { onConflict: "user_id" },
    );
    if (profileError) throw new Error(profileError.message);

    const { error: deleteExperienceError } = await supabase
      .from("experiences")
      .delete()
      .eq("user_id", userId);
    if (deleteExperienceError) throw new Error(deleteExperienceError.message);

    if (data.experience?.company.trim() && data.experience.title.trim()) {
      const endText = data.experience.end.trim();
      const { error } = await supabase.from("experiences").insert({
        user_id: userId,
        company: clean(data.experience.company, 220),
        title: clean(data.experience.title, 220),
        start_date: parseMonthDate(data.experience.start),
        end_date: parseMonthDate(data.experience.end),
        is_current: /actual|presente|present|current|hoy/i.test(endText),
        description: clean(data.experience.description, 5000) || null,
        achievements: data.experience.achievements
          .split(/\n|;/)
          .map((achievement) => clean(achievement, 1000))
          .filter(Boolean)
          .slice(0, 12),
        source: data.baseResumePath ? "cv_parse" : "manual",
        verified_by_user: true,
        sort_order: 0,
      });
      if (error) throw new Error(error.message);
    }

    const { error: deleteEducationError } = await supabase
      .from("educations")
      .delete()
      .eq("user_id", userId);
    if (deleteEducationError) throw new Error(deleteEducationError.message);

    if (data.education?.institution.trim()) {
      const range = parseStudyRange(data.education.studyDates);
      const { error } = await supabase.from("educations").insert({
        user_id: userId,
        institution: clean(data.education.institution, 260),
        degree: clean(data.education.degree, 260) || null,
        field: clean(data.education.field, 260) || null,
        start_date: range.startDate,
        end_date: range.endDate,
        is_current: range.isCurrent,
        verified_by_user: true,
      });
      if (error) throw new Error(error.message);
    }

    const uniqueSkills = [...new Set(data.skills.map((skill) => clean(skill, 120)).filter(Boolean))].slice(0, 50);
    const { error: deleteSkillsError } = await supabase.from("skills").delete().eq("user_id", userId);
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

    const { error: deleteLanguagesError } = await supabase
      .from("languages")
      .delete()
      .eq("user_id", userId);
    if (deleteLanguagesError) throw new Error(deleteLanguagesError.message);
    if (uniqueLanguages.length) {
      const { error } = await supabase.from("languages").insert(
        uniqueLanguages.map((language) => ({
          user_id: userId,
          language: clean(language.language, 120),
          level: clean(language.level, 80),
        })),
      );
      if (error) throw new Error(error.message);
    }

    const modes = modeFlags(data.preferences.modes);
    const { error: preferencesError } = await supabase.from("job_preferences").upsert(
      {
        user_id: userId,
        target_roles: data.preferences.targetRoles.map((value) => clean(value, 180)).filter(Boolean).slice(0, 12),
        target_locations: data.preferences.targetLocations.map((value) => clean(value, 180)).filter(Boolean).slice(0, 12),
        remote_allowed: modes.remote,
        hybrid_allowed: modes.hybrid,
        onsite_allowed: modes.onsite,
        employment_types: data.preferences.employmentTypes.map((value) => clean(value, 80)).filter(Boolean).slice(0, 12),
        minimum_salary: data.preferences.minimumSalary,
        salary_currency: data.preferences.salaryCurrency ? clean(data.preferences.salaryCurrency, 12) : null,
        salary_period: data.preferences.salaryPeriod ? clean(data.preferences.salaryPeriod, 40) : null,
        seniority_levels: data.preferences.seniorityLevels.map((value) => clean(value, 80)).filter(Boolean).slice(0, 12),
        willing_to_relocate: data.preferences.willingToRelocate,
        international_remote: data.preferences.internationalRemote,
        preferred_industries: data.preferences.preferredIndustries.map((value) => clean(value, 120)).filter(Boolean).slice(0, 30),
        excluded_companies: [],
        excluded_industries: [],
        minimum_match_score: Math.max(0, Math.min(100, data.preferences.minimumMatchScore)),
      },
      { onConflict: "user_id" },
    );
    if (preferencesError) throw new Error(preferencesError.message);

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
      .filter((answer): answer is readonly [string, boolean] => answer[1] !== null)
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

    const now = new Date().toISOString();
    const { error: consentError } = await supabase.from("auto_apply_consents").upsert(
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

    return {
      ok: true,
      masterProfileVersion: nextVersion,
      dealbreakers: data.preferences.dealbreakers,
    };
  });
