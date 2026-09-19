import { db } from "../supabase.js";
import { ApplicationError } from "../utils/errors.js";
import type { JobRecord, MasterProfile } from "../adapters/types.js";

/** Loads the job to apply to. A missing or inactive job is an expired job. */
export async function loadJob(jobId: string): Promise<JobRecord> {
  const { data, error } = await db()
    .from("jobs")
    .select("id, title, description, location, application_url, ats_type, is_active, auto_apply_eligible, companies(name)")
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw new ApplicationError("UNKNOWN_ERROR", error.message);
  if (!data || !data.is_active) throw new ApplicationError("JOB_EXPIRED", "The job is no longer active.");
  if (!data.application_url) throw new ApplicationError("UNSUPPORTED_FIELD", "The job has no public application URL.");
  if (!data.auto_apply_eligible) throw new ApplicationError("UNSUPPORTED_FIELD", "The job is not Auto Apply eligible.");

  return {
    id: data.id,
    title: data.title,
    description: data.description ?? "",
    company: (data.companies as { name?: string } | null)?.name ?? "",
    location: data.location,
    applicationUrl: data.application_url,
    atsType: data.ats_type,
  };
}

/** Assembles the MasterProfile: the only factual source for CVs and answers. */
export async function loadMasterProfile(userId: string): Promise<MasterProfile> {
  const supabase = db();
  const [profile, experiences, educations, skills, languages, answers] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("experiences").select("*").eq("user_id", userId).order("start_date", { ascending: false }),
    supabase.from("educations").select("*").eq("user_id", userId),
    supabase.from("skills").select("*").eq("user_id", userId),
    supabase.from("languages").select("*").eq("user_id", userId),
    supabase.from("application_answers").select("*").eq("user_id", userId),
  ]);

  const p = profile.data;
  if (!p) throw new ApplicationError("UNSUPPORTED_FIELD", "The user has no career profile yet.");

  return {
    userId,
    masterProfileVersion: p.master_profile_version ?? 1,
    identity: {
      firstName: p.first_name ?? "",
      lastName: p.last_name ?? "",
      email: p.email ?? "",
      phone: p.phone ?? "",
      city: p.city ?? "",
      country: p.country ?? "",
      currentTitle: p.current_title ?? "",
      professionalSummary: p.professional_summary ?? "",
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
    education: (educations.data ?? []).map((e) => ({
      id: e.id,
      institution: e.institution,
      degree: e.degree ?? "",
      field: e.field ?? "",
      startDate: e.start_date,
      endDate: e.end_date,
    })),
    skills: (skills.data ?? []).map((s) => ({ id: s.id, name: s.name })),
    languages: (languages.data ?? []).map((l) => ({ language: l.language, level: l.level })),
    verifiedApplicationAnswers: (answers.data ?? []).map((a) => ({
      canonicalKey: a.canonical_key,
      answerType: a.answer_type,
      booleanValue: a.boolean_value,
      textValue: a.text_value,
      numericValue: a.numeric_value,
      userConfirmed: a.user_confirmed,
    })),
    links: { linkedin: p.linkedin_url ?? "", portfolio: p.portfolio_url ?? "" },
  };
}

/** Guards against a second application to the same job for the same user. */
export async function assertNotDuplicate(userId: string, jobId: string): Promise<void> {
  const { data } = await db()
    .from("application_attempts")
    .select("id")
    .eq("user_id", userId)
    .eq("job_id", jobId)
    .eq("status", "verified")
    .maybeSingle();
  if (data) throw new ApplicationError("DUPLICATE_APPLICATION", "A verified application already exists for this job.");
}
