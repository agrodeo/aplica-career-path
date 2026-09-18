import type { MasterProfile } from "./types";

export interface StructuredResume {
  professionalSummary: string;
  experience: { experienceId: string; company: string; title: string; startDate: string | null; endDate: string | null; bullets: string[] }[];
  education: { educationId: string; institution: string; degree: string; field: string }[];
  skills: string[];
  languages: { language: string; level: string }[];
}

export interface ValidationIssue {
  field: string;
  claim: string;
  reason:
    | "unknown_employer"
    | "unknown_title"
    | "date_mismatch"
    | "unknown_education"
    | "unknown_skill"
    | "unverified_metric"
    | "unknown_language"
    | "unsupported_certification";
}

export interface ValidationOutcome {
  status: "passed" | "failed";
  issues: ValidationIssue[];
}

const METRIC_PATTERN = /(\d+(?:[.,]\d+)?)\s*(%|x|k|m|mm|millones|usd|eur|ars)?/gi;

function has(list: string[], value: string) {
  return list.some((item) => item.trim().toLowerCase() === value.trim().toLowerCase());
}

/**
 * Every factual claim in generated content must trace back to MasterProfile.
 * Rewording, reordering, shortening and emphasis are allowed. Inventing
 * employers, titles, dates, degrees, skills, metrics or legal answers is not.
 */
export function validateResumeAgainstProfile(resume: StructuredResume, profile: MasterProfile): ValidationOutcome {
  const issues: ValidationIssue[] = [];
  const companies = profile.experience.map((e) => e.company);
  const titles = profile.experience.map((e) => e.title);
  const skillNames = profile.skills.map((s) => s.name);
  const institutions = profile.education.map((e) => e.institution);
  const sourceText = [
    profile.identity.professionalSummary,
    ...profile.experience.flatMap((e) => [e.description, ...e.achievements]),
  ].join(" \n ").toLowerCase();

  for (const exp of resume.experience) {
    const source = profile.experience.find((e) => e.id === exp.experienceId);
    if (!source) {
      issues.push({ field: "experience", claim: `${exp.title} — ${exp.company}`, reason: "unknown_employer" });
      continue;
    }
    if (!has(companies, exp.company)) issues.push({ field: "experience.company", claim: exp.company, reason: "unknown_employer" });
    if (!has(titles, exp.title)) issues.push({ field: "experience.title", claim: exp.title, reason: "unknown_title" });
    if ((exp.startDate ?? null) !== (source.startDate ?? null) || (exp.endDate ?? null) !== (source.endDate ?? null)) {
      issues.push({ field: "experience.dates", claim: `${exp.startDate} → ${exp.endDate}`, reason: "date_mismatch" });
    }
    for (const bullet of exp.bullets) {
      for (const metric of bullet.matchAll(METRIC_PATTERN)) {
        const raw = metric[0].trim().toLowerCase();
        if (raw.length < 2) continue;
        if (!sourceText.includes(raw) && !sourceText.includes(metric[1] ?? "")) {
          issues.push({ field: "experience.bullets", claim: metric[0], reason: "unverified_metric" });
        }
      }
    }
  }

  for (const edu of resume.education) {
    const source = profile.education.find((e) => e.id === edu.educationId);
    if (!source || !has(institutions, edu.institution)) {
      issues.push({ field: "education", claim: `${edu.degree} — ${edu.institution}`, reason: "unknown_education" });
      continue;
    }
    if (edu.degree && source.degree && edu.degree.toLowerCase() !== source.degree.toLowerCase()) {
      issues.push({ field: "education.degree", claim: edu.degree, reason: "unknown_education" });
    }
  }

  for (const skill of resume.skills) {
    if (!has(skillNames, skill)) issues.push({ field: "skills", claim: skill, reason: "unknown_skill" });
  }

  for (const lang of resume.languages) {
    const source = profile.languages.find((l) => l.language.toLowerCase() === lang.language.toLowerCase());
    if (!source || source.level.toLowerCase() !== lang.level.toLowerCase()) {
      issues.push({ field: "languages", claim: `${lang.language} — ${lang.level}`, reason: "unknown_language" });
    }
  }

  return { status: issues.length ? "failed" : "passed", issues };
}

/** Application answers may only come from user-confirmed profile answers. */
export function validateAnswers(
  answers: Record<string, string | number | boolean>,
  profile: MasterProfile,
): { status: "passed" | "failed"; unsupportedKeys: string[] } {
  const identityKeys = new Set(["first_name", "last_name", "email", "phone", "city", "country", "linkedin", "portfolio", "resume"]);
  const unsupportedKeys = Object.keys(answers).filter((key) => {
    if (identityKeys.has(key)) return false;
    return !profile.verifiedApplicationAnswers.some((a) => a.canonicalKey === key && a.userConfirmed);
  });
  return { status: unsupportedKeys.length ? "failed" : "passed", unsupportedKeys };
}
