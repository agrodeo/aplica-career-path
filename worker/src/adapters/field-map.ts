import type { CanonicalKey } from "./types.js";

/** Label patterns mapped to canonical keys. Order matters: first match wins. */
const PATTERNS: { key: CanonicalKey; patterns: RegExp[] }[] = [
  { key: "first_name", patterns: [/^first\s*name/i, /given\s*name/i, /^nombre/i] },
  { key: "last_name", patterns: [/^last\s*name/i, /family\s*name/i, /surname/i, /^apellido/i] },
  { key: "full_name", patterns: [/^full\s*name/i, /^name$/i, /nombre\s*completo/i] },
  { key: "email", patterns: [/e-?mail/i, /correo/i] },
  { key: "phone", patterns: [/phone/i, /mobile/i, /tel[eé]fono/i] },
  { key: "country", patterns: [/^country\b/i, /^pa[ií]s\b/i, /country of residence/i] },
  { key: "location", patterns: [/location/i, /city/i, /where are you based/i, /ciudad/i, /ubicaci[oó]n/i] },
  { key: "linkedin", patterns: [/linkedin/i] },
  { key: "portfolio", patterns: [/portfolio/i, /github/i, /portafolio/i] },
  { key: "website", patterns: [/website/i, /personal site/i, /sitio web/i] },
  { key: "resume", patterns: [/resume/i, /^cv\b/i, /curriculum/i, /curr[ií]culum/i] },
  { key: "cover_letter", patterns: [/cover\s*letter/i, /carta de presentaci[oó]n/i] },
  { key: "current_company", patterns: [/current\s*(company|employer)/i, /empresa actual/i] },
  { key: "current_title", patterns: [/current\s*(title|role|position)/i, /puesto actual/i] },
  { key: "work_authorization", patterns: [/legally authorized/i, /work authorization/i, /authorized to work/i, /right to work/i] },
  { key: "sponsorship", patterns: [/sponsorship/i, /visa\s*support/i, /require.*visa/i] },
  { key: "salary_expectation", patterns: [/salary\s*(expectation|requirement)/i, /expected salary/i, /pretensi[oó]n salarial/i] },
  { key: "relocation", patterns: [/relocat/i, /mudarte/i] },
  { key: "notice_period", patterns: [/notice period/i, /when can you start/i, /start date/i, /disponibilidad/i] },
  { key: "years_experience", patterns: [/years of experience/i, /a[ñn]os de experiencia/i] },
];

const DEMOGRAPHIC_PATTERNS = [
  /gender/i,
  /race|ethnic/i,
  /veteran/i,
  /disability/i,
  /hispanic|latino/i,
  /sexual orientation/i,
  /g[eé]nero/i,
  /discapacidad/i,
];

export function canonicalKeyFor(label: string): CanonicalKey | null {
  const clean = label.replace(/\*/g, " ").replace(/\s+/g, " ").trim();
  for (const entry of PATTERNS) {
    if (entry.patterns.some((pattern) => pattern.test(clean))) return entry.key;
  }
  return null;
}

export function isDemographicQuestion(label: string): boolean {
  return DEMOGRAPHIC_PATTERNS.some((pattern) => pattern.test(label));
}

/** Finds an explicit decline option for optional demographic questions. */
export function findDeclineOption(options: { label: string; value: string }[]) {
  return options.find((option) => /decline|prefer not|do not wish|no deseo|prefiero no/i.test(option.label)) ?? null;
}


/**
 * Unknown employer questions still need a stable identity so Aplica can ask the
 * user once and safely reuse the explicitly confirmed answer for that exact
 * question on retries.
 */
export function answerKeyFor(label: string): string {
  const canonical = canonicalKeyFor(label);
  if (canonical) return canonical;

  const normalized = label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\*/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  let hash = 2166136261;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  const slug = normalized.replace(/\s+/g, "-").slice(0, 120) || "question";
  return `custom:${slug}:${(hash >>> 0).toString(36)}`;
}
