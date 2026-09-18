import { findDeclineOption } from "../adapters/field-map.js";
import { SENSITIVE_KEYS, type ApplicationSchema, type InspectedField, type JobRecord, type MasterProfile, type PreparedAnswer } from "../adapters/types.js";
import { ApplicationError } from "../utils/errors.js";

/**
 * Deterministic answers. Every value comes from MasterProfile identity data or
 * an explicitly confirmed application answer. Sensitive questions are answered
 * ONLY from stored answers, never inferred. Optional demographic questions get
 * an explicit "decline to answer" option when one exists, otherwise are skipped.
 */
export function prepareAnswers(schema: ApplicationSchema, profile: MasterProfile, job: JobRecord): PreparedAnswer[] {
  const answers: PreparedAnswer[] = [];

  for (const field of schema.fields) {
    if (field.type === "file") {
      if (field.canonicalKey === "resume" || /resume|cv|curr/i.test(field.label)) {
        answers.push({ field, value: "@resume", source: "profile" });
      }
      continue;
    }

    if (field.demographic) {
      const decline = field.options ? findDeclineOption(field.options) : null;
      const stored = storedAnswer(profile, field.label);
      if (stored !== null) answers.push({ field, value: stored, source: "verified_answer" });
      else if (decline) answers.push({ field, value: decline.value, source: "decline" });
      else if (field.required) {
        throw new ApplicationError("UNSUPPORTED_FIELD", `Required demographic question without a decline option: ${field.label}`);
      }
      continue;
    }

    const value = resolveValue(field, profile, job);
    if (value !== null) {
      answers.push({ field, value, source: field.canonicalKey && SENSITIVE_KEYS.includes(field.canonicalKey) ? "verified_answer" : value === generatedInterest(profile, job) ? "generated" : "profile" });
      continue;
    }
    if (field.required) throw new ApplicationError("UNSUPPORTED_FIELD", `Required question without a verified answer: ${field.label}`);
  }

  return answers;
}

function storedAnswer(profile: MasterProfile, key: string): string | boolean | null {
  const stored = profile.verifiedApplicationAnswers.find((a) => a.canonicalKey === key && a.userConfirmed);
  if (!stored) return null;
  if (stored.answerType === "boolean") return stored.booleanValue ?? null;
  if (stored.answerType === "numeric") return stored.numericValue === null ? null : String(stored.numericValue);
  return stored.textValue ?? null;
}

function resolveValue(
  field: InspectedField,
  profile: MasterProfile,
  job: JobRecord,
): string | boolean | null {
  const key = field.canonicalKey;
  if (!key) return null;

  // Sensitive: explicit stored answers only.
  if (SENSITIVE_KEYS.includes(key)) {
    const stored = storedAnswer(profile, key);
    return normalizeForField(field, stored, profile);
  }

  const identity = profile.identity;
  const current =
    profile.experience.find((e) => e.isCurrent) ?? profile.experience[0];

  let value: string | boolean | null;
  switch (key) {
    case "first_name":
      value = identity.firstName || null;
      break;
    case "last_name":
      value = identity.lastName || null;
      break;
    case "full_name":
      value =
        [identity.firstName, identity.lastName].filter(Boolean).join(" ") || null;
      break;
    case "email":
      value = identity.email || null;
      break;
    case "phone":
      value = identity.phone || null;
      break;
    case "location":
      value =
        [identity.city, identity.country].filter(Boolean).join(", ") || null;
      break;
    case "linkedin":
      value = profile.links.linkedin || null;
      break;
    case "portfolio":
    case "website":
      value = profile.links.portfolio || null;
      break;
    case "current_company":
      value = current?.company ?? null;
      break;
    case "current_title":
      value = identity.currentTitle || current?.title || null;
      break;
    case "years_experience":
      value = String(yearsOfExperience(profile));
      break;
    case "cover_letter":
      value = generatedInterest(profile, job);
      break;
    default:
      value = storedAnswer(profile, key);
      break;
  }

  return normalizeForField(field, value, profile);
}

/**
 * Select/radio controls require the ATS option value, not arbitrary profile
 * text. We only choose an option on an exact, explainable match; otherwise the
 * field is considered unanswered instead of guessing.
 */
function normalizeForField(
  field: InspectedField,
  value: string | boolean | null,
  profile: MasterProfile,
): string | boolean | null {
  if (value === null || !field.options?.length) return value;

  const options = field.options;
  if (typeof value === "boolean") {
    const expected = value ? /^(yes|sí|si|true)$/i : /^(no|false)$/i;
    const match = options.find(
      (option) =>
        expected.test(option.label.trim()) || expected.test(option.value.trim()),
    );
    return match?.value ?? null;
  }

  const normalized = value.trim().toLowerCase();
  const exact = options.find(
    (option) =>
      option.value.trim().toLowerCase() === normalized ||
      option.label.trim().toLowerCase() === normalized,
  );
  if (exact) return exact.value;

  // Location dropdowns commonly ask for country or city rather than the full
  // "City, Country" string. Exact component matches are safe; fuzzy guessing is not.
  if (field.canonicalKey === "location") {
    const components = [profile.identity.city, profile.identity.country]
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean);
    const match = options.find((option) => {
      const label = option.label.trim().toLowerCase();
      const optionValue = option.value.trim().toLowerCase();
      return components.includes(label) || components.includes(optionValue);
    });
    return match?.value ?? null;
  }

  return null;
}

export function yearsOfExperience(profile: MasterProfile): number {
  const months = profile.experience.reduce((total, exp) => {
    if (!exp.startDate) return total;
    const start = new Date(exp.startDate).getTime();
    const end = exp.endDate ? new Date(exp.endDate).getTime() : Date.now();
    return total + Math.max(0, (end - start) / (1000 * 60 * 60 * 24 * 30.4));
  }, 0);
  return Math.floor(months / 12);
}

/**
 * Open questions (interest / cover letter) are composed ONLY from the job title,
 * the company name and verified profile facts. No new claim is introduced.
 */
export function generatedInterest(profile: MasterProfile, job: JobRecord): string {
  const current = profile.experience.find((e) => e.isCurrent) ?? profile.experience[0];
  const skills = profile.skills.slice(0, 4).map((s) => s.name);
  const parts = [
    `Me interesa el puesto de ${job.title}${job.company ? ` en ${job.company}` : ""}.`,
    current ? `Actualmente trabajo como ${current.title} en ${current.company}.` : null,
    skills.length ? `Mi experiencia incluye ${skills.join(", ")}.` : null,
    profile.identity.professionalSummary ? profile.identity.professionalSummary.trim() : null,
  ].filter(Boolean);
  return parts.join(" ");
}

export interface AnswerValidation {
  valid: boolean;
  unsupportedClaims: string[];
}

/**
 * Validates a generated free-text answer: every proper noun, employer, title,
 * skill and number in it must appear in MasterProfile or the job itself.
 */
export function validateGeneratedAnswer(answer: string, profile: MasterProfile, job: JobRecord): AnswerValidation {
  const allowed = [
    job.title,
    job.company,
    job.location ?? "",
    profile.identity.firstName,
    profile.identity.lastName,
    profile.identity.currentTitle,
    profile.identity.city,
    profile.identity.country,
    profile.identity.professionalSummary,
    ...profile.experience.flatMap((e) => [e.company, e.title, e.description, ...e.achievements]),
    ...profile.education.flatMap((e) => [e.institution, e.degree, e.field]),
    ...profile.skills.map((s) => s.name),
    ...profile.languages.map((l) => `${l.language} ${l.level}`),
  ]
    .join(" ")
    .toLowerCase();

  const unsupportedClaims: string[] = [];

  for (const match of answer.matchAll(/\b\d+(?:[.,]\d+)?%?\b/g)) {
    if (!allowed.includes(match[0].toLowerCase())) unsupportedClaims.push(match[0]);
  }
  for (const match of answer.matchAll(/\b[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ]{2,}(?:\s+[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ]{2,})*/g)) {
    const candidate = match[0];
    if (answer.indexOf(candidate) === 0) continue; // sentence start
    if (!allowed.includes(candidate.toLowerCase())) unsupportedClaims.push(candidate);
  }

  return { valid: unsupportedClaims.length === 0, unsupportedClaims };
}
