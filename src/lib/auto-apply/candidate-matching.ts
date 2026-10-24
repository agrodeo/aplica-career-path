import { inferSeniority, normalizeCountryCode } from "../job-sources/normalization";

const countryNames = new Intl.DisplayNames(["en"], { type: "region" });

const TITLE_NOISE = new Set([
  "senior","sr","junior","jr","lead","principal","staff","head","associate","intern","internship",
  "remote","latam","global","the","and","of","de","del","la","el","y",
]);

export function normalizeText(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9+#.]+/g, " ").replace(/\s+/g, " ").trim();
}

function words(value: string, removeNoise = false) {
  return new Set(normalizeText(value).split(" ").filter((word) => word.length > 1 && (!removeNoise || !TITLE_NOISE.has(word))));
}

export function similarity(a: string, b: string) {
  const left = words(a, true);
  const right = words(b, true);
  if (!left.size || !right.size) return 0;
  const intersection = [...left].filter((word) => right.has(word)).length;
  const precision = intersection / left.size;
  const recall = intersection / right.size;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const na = normalizeText(a);
  const nb = normalizeText(b);
  return Math.min(100, Math.max(Math.round(f1 * 85), na.includes(nb) || nb.includes(na) ? 92 : 0));
}

export function includesLoose(haystack: string | null | undefined, needle: string | null | undefined) {
  if (!haystack || !needle) return false;
  const a = normalizeText(haystack);
  const b = normalizeText(needle);
  return Boolean(a && b) && (` ${a} `.includes(` ${b} `));
}

export function normalizeMode(value: string | null) {
  const mode = (value ?? "").toLowerCase();
  if (/remote|remoto/.test(mode)) return "remote";
  if (/hybrid|hibr|híbr/.test(mode)) return "hybrid";
  if (/onsite|on-site|presencial|office/.test(mode)) return "onsite";
  return "unknown";
}


const LATAM_COUNTRY_CODES = new Set([
  "ar","bo","br","cl","co","cr","do","ec","gt","hn","mx","ni","pa","pe","pr","py","sv","uy","ve",
]);

const LOCATION_ALIASES: Record<string, string[]> = {
  argentina: ["ar", "argentina", "buenos aires"],
  ar: ["ar", "argentina", "buenos aires"],
  brazil: ["br", "brazil", "brasil", "sao paulo", "rio de janeiro"],
  brasil: ["br", "brazil", "brasil", "sao paulo", "rio de janeiro"],
  br: ["br", "brazil", "brasil", "sao paulo", "rio de janeiro"],
  mexico: ["mx", "mexico", "mexico city", "ciudad de mexico"],
  mx: ["mx", "mexico", "mexico city", "ciudad de mexico"],
  colombia: ["co", "colombia", "bogota", "medellin"],
  co: ["co", "colombia", "bogota", "medellin"],
  chile: ["cl", "chile"],
  cl: ["cl", "chile"],
  peru: ["pe", "peru", "lima"],
  pe: ["pe", "peru", "lima"],
  uruguay: ["uy", "uruguay", "montevideo"],
  uy: ["uy", "uruguay", "montevideo"],
  ecuador: ["ec", "ecuador", "quito", "guayaquil"],
  ec: ["ec", "ecuador", "quito", "guayaquil"],
  paraguay: ["py", "paraguay", "asuncion"],
  py: ["py", "paraguay", "asuncion"],
  bolivia: ["bo", "bolivia"],
  bo: ["bo", "bolivia"],
  "costa rica": ["cr", "costa rica"],
  cr: ["cr", "costa rica"],
  panama: ["pa", "panama"],
  pa: ["pa", "panama"],
};

function geoText(location: string | null | undefined, country: string | null | undefined) {
  return normalizeText(`${location ?? ""} ${country ?? ""}`);
}

function isLatamGeo(location: string | null | undefined, country: string | null | undefined) {
  const code = normalizeText(country ?? "");
  if (LATAM_COUNTRY_CODES.has(code)) return true;
  const text = geoText(location, country);
  return /\blatam\b|latin america|south america|argentina|brazil|brasil|mexico|colombia|chile|peru|uruguay|ecuador|paraguay|bolivia|costa rica|panama|guatemala|honduras|el salvador|nicaragua|dominican republic|puerto rico|buenos aires|sao paulo|bogota|medellin|montevideo|lima|quito|guayaquil|asuncion/.test(text);
}

export function locationMatchesTarget(
  location: string | null | undefined,
  country: string | null | undefined,
  target: string,
) {
  if (includesLoose(location, target) || includesLoose(country, target)) return true;

  const normalizedTarget = normalizeText(target);
  if (/^(latam|latin america|south america)$/.test(normalizedTarget)) {
    return isLatamGeo(location, country);
  }

  const aliases = LOCATION_ALIASES[normalizedTarget] ?? [];
  const jobCode = normalizeCountryCode(country, location);
  const targetCode = normalizeCountryCode(target);
  const countryName = targetCode ? countryNames.of(targetCode.toUpperCase()) : null;
  const targetIsCountry = aliases.length > 0 || /^[a-z]{2}$/.test(normalizedTarget) || normalizeText(countryName ?? "") === normalizedTarget;
  if (targetIsCountry && targetCode && jobCode && targetCode === jobCode) return true;
  const text = geoText(location, country);
  if (aliases.some((alias) => {
    const normalizedAlias = normalizeText(alias);
    return text === normalizedAlias || text.includes(` ${normalizedAlias} `) || text.startsWith(`${normalizedAlias} `) || text.endsWith(` ${normalizedAlias}`);
  })) {
    return true;
  }

  // A role explicitly open to LATAM/South America is compatible with any
  // individual LATAM-country preference.
  if (aliases.length && /\blatam\b|latin america|south america/.test(text)) {
    return true;
  }

  return false;
}


export interface MatchJobConstraints {
  title: string;
  description?: string | null;
  location: string | null;
  country: string | null;
  remote_type: string | null;
  employment_type?: string | null;
  seniority?: string | null;
  company_id?: string | null;
  companies?: { name: string } | null;
}

export interface MatchPreferences {
  target_locations?: string[];
  remote_allowed?: boolean;
  hybrid_allowed?: boolean;
  onsite_allowed?: boolean;
  willing_to_relocate?: boolean;
  employment_types?: string[];
  seniority_levels?: string[];
  excluded_companies?: string[];
}

function employment(value: string) {
  const normalized = normalizeText(value).replace(/[ _-]/g, "");
  return ({ contractor: "contract", freelance: "contract", intern: "internship" } as Record<string, string>)[normalized] ?? normalized;
}

/** A remote label never overrides an explicit residence restriction. */
export function checkMatchConstraints(job: MatchJobConstraints, pref: MatchPreferences, fallbackLocations: string[] = []) {
  const targets = pref.target_locations?.length ? pref.target_locations : fallbackLocations;
  const mode = normalizeMode(job.remote_type);
  const modeAllowed = mode === "remote" ? pref.remote_allowed !== false
    : mode === "hybrid" ? pref.hybrid_allowed !== false
    : mode === "onsite" ? pref.onsite_allowed === true : false;
  const restriction = job.description?.match(/(?:must|need to|required to)\s+be\s+(?:based|located|resident)\s+in\s+([^.;\n]{2,100})/i)?.[1];
  const descriptionLocationMet = !restriction || targets.some((target) => locationMatchesTarget(restriction, null, target));
  const locationMatched = targets.some((target) => locationMatchesTarget(job.location, job.country, target)) ||
    (mode === "remote" && targets.length > 0 && /\b(worldwide|anywhere|global)\b/.test(normalizeText(job.location ?? "")) && !job.country);
  const locationAllowed = descriptionLocationMet && (locationMatched || (mode !== "remote" && pref.willing_to_relocate === true));
  const employmentAllowed = !pref.employment_types?.length || !job.employment_type || pref.employment_types.some((value) => employment(value) === employment(job.employment_type!));
  const seniority = job.seniority ?? inferSeniority(job.title);
  const seniorityAllowed = !pref.seniority_levels?.length || !seniority || pref.seniority_levels.some((value) => employment(value) === employment(seniority));
  const companyAllowed = !pref.excluded_companies?.some((name) => normalizeText(name) === normalizeText(job.companies?.name ?? "") || name === job.company_id);
  return { modeAllowed, locationRequirementMet: locationAllowed, employmentAllowed, seniorityAllowed, companyAllowed };
}
