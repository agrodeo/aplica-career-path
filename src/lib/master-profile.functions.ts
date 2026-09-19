import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { MasterProfile, MasterPreferences } from "./auto-apply/types";

const emptyPreferences: MasterPreferences = {
  targetRoles: [],
  targetLocations: [],
  remoteAllowed: true,
  hybridAllowed: true,
  onsiteAllowed: false,
  employmentTypes: [],
  minimumSalary: null,
  salaryCurrency: null,
  salaryPeriod: null,
  seniorityLevels: [],
  willingToRelocate: false,
  internationalRemote: true,
  excludedCompanies: [],
  excludedIndustries: [],
  preferredIndustries: [],
  minimumMatchScore: 80,
  maximumApplicationsPerWeek: null,
};

/**
 * Assembles every piece of career information into the single normalized
 * MasterProfile object. This is the ONLY factual source used by CV generation
 * and application answers.
 */
export const getMasterProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MasterProfile> => {
    const { supabase, userId } = context;
    const [profile, experiences, educations, skills, languages, preferences, answers] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("experiences").select("*").eq("user_id", userId).order("sort_order", { ascending: true }),
      supabase.from("educations").select("*").eq("user_id", userId),
      supabase.from("skills").select("*").eq("user_id", userId),
      supabase.from("languages").select("*").eq("user_id", userId),
      supabase.from("job_preferences").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("application_answers").select("*").eq("user_id", userId),
    ]);

    const p = profile.data;
    const pref = preferences.data;

    return {
      userId,
      identity: {
        firstName: p?.first_name ?? "",
        lastName: p?.last_name ?? "",
        email: p?.email ?? "",
        phone: p?.phone ?? "",
        whatsapp: p?.whatsapp ?? "",
        city: p?.city ?? "",
        country: p?.country ?? "",
        currentTitle: p?.current_title ?? "",
        professionalSummary: p?.professional_summary ?? "",
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
        verifiedByUser: e.verified_by_user,
      })),
      education: (educations.data ?? []).map((e) => ({
        id: e.id,
        institution: e.institution,
        degree: e.degree ?? "",
        field: e.field ?? "",
        startDate: e.start_date,
        endDate: e.end_date,
        isCurrent: e.is_current,
        verifiedByUser: e.verified_by_user,
      })),
      skills: (skills.data ?? []).map((s) => ({ id: s.id, name: s.name, yearsExperience: s.years_experience, verifiedByUser: s.verified_by_user })),
      languages: (languages.data ?? []).map((l) => ({ language: l.language, level: l.level })),
      preferences: pref
        ? {
            targetRoles: pref.target_roles,
            targetLocations: pref.target_locations,
            remoteAllowed: pref.remote_allowed,
            hybridAllowed: pref.hybrid_allowed,
            onsiteAllowed: pref.onsite_allowed,
            employmentTypes: pref.employment_types,
            minimumSalary: pref.minimum_salary,
            salaryCurrency: pref.salary_currency,
            salaryPeriod: pref.salary_period,
            seniorityLevels: pref.seniority_levels,
            willingToRelocate: pref.willing_to_relocate,
            internationalRemote: pref.international_remote,
            excludedCompanies: pref.excluded_companies,
            excludedIndustries: pref.excluded_industries,
            preferredIndustries: pref.preferred_industries,
            minimumMatchScore: Number(pref.minimum_match_score),
            maximumApplicationsPerWeek: pref.maximum_applications_per_week,
          }
        : emptyPreferences,
      verifiedApplicationAnswers: (answers.data ?? []).map((a) => ({
        canonicalKey: a.canonical_key,
        answerType: a.answer_type as "boolean" | "text" | "numeric",
        booleanValue: a.boolean_value,
        textValue: a.text_value,
        numericValue: a.numeric_value,
        userConfirmed: a.user_confirmed,
      })),
      links: { linkedin: p?.linkedin_url ?? "", portfolio: p?.portfolio_url ?? "" },
      baseResumePath: p?.base_resume_path ?? null,
    };
  });

export const saveMasterProfileBasics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { firstName?: string; lastName?: string; email?: string; phone?: string; city?: string; country?: string; currentTitle?: string; professionalSummary?: string }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("profiles").upsert(
      {
        user_id: context.userId,
        first_name: data.firstName ?? null,
        last_name: data.lastName ?? null,
        email: data.email ?? null,
        phone: data.phone ?? null,
        city: data.city ?? null,
        country: data.country ?? null,
        current_title: data.currentTitle ?? null,
        professional_summary: data.professionalSummary ?? null,
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveJobPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Partial<MasterPreferences>) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("job_preferences").upsert(
      {
        user_id: context.userId,
        target_roles: data.targetRoles ?? [],
        target_locations: data.targetLocations ?? [],
        remote_allowed: data.remoteAllowed ?? true,
        hybrid_allowed: data.hybridAllowed ?? true,
        onsite_allowed: data.onsiteAllowed ?? false,
        employment_types: data.employmentTypes ?? [],
        minimum_salary: data.minimumSalary ?? null,
        salary_currency: data.salaryCurrency ?? null,
        salary_period: data.salaryPeriod ?? null,
        seniority_levels: data.seniorityLevels ?? [],
        willing_to_relocate: data.willingToRelocate ?? false,
        international_remote: data.internationalRemote ?? true,
        excluded_companies: data.excludedCompanies ?? [],
        excluded_industries: data.excludedIndustries ?? [],
        preferred_industries: data.preferredIndustries ?? [],
        minimum_match_score: data.minimumMatchScore ?? 80,
        maximum_applications_per_week: data.maximumApplicationsPerWeek ?? null,
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getAutoApplyConsent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("auto_apply_consents").select("*").eq("user_id", context.userId).maybeSingle();
    return { authorized: data?.authorized === true && !data?.revoked_at, termsVersion: data?.terms_version ?? null };
  });

export const setAutoApplyConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { authorized: boolean; termsVersion?: string }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("auto_apply_consents").upsert(
      {
        user_id: context.userId,
        authorized: data.authorized,
        authorized_at: data.authorized ? new Date().toISOString() : null,
        revoked_at: data.authorized ? null : new Date().toISOString(),
        terms_version: data.termsVersion ?? "v1",
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
