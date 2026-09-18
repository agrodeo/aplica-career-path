import type { JobRecord, MasterProfile } from "./types";

export interface MatchBreakdown {
  matchScore: number;
  roleScore: number;
  skillsScore: number;
  experienceScore: number;
  locationScore: number;
  seniorityScore: number;
  preferencesScore: number;
  hardRequirementsMet: boolean;
  explanation: { fit: string[]; concerns: string[]; rejectedBy?: string[] };
}

function normalize(value: string | null | undefined) {
  return (value ?? "").toLowerCase();
}

function tokens(value: string | null | undefined) {
  return normalize(value).split(/[^a-záéíóúñ0-9+]+/i).filter((t) => t.length > 2);
}

/**
 * STAGE 1 — deterministic filters. Rejects impossible jobs before any
 * semantic or model-based work happens.
 */
export function passesHardFilters(job: JobRecord, profile: MasterProfile): { passed: boolean; rejectedBy: string[] } {
  const p = profile.preferences;
  const rejectedBy: string[] = [];
  const remote = normalize(job.remoteType);

  if (remote.includes("remot") && !p.remoteAllowed) rejectedBy.push("remote_not_allowed");
  if (remote.includes("hibr") || remote.includes("hybrid")) { if (!p.hybridAllowed) rejectedBy.push("hybrid_not_allowed"); }
  if (remote.includes("presen") || remote.includes("onsite")) { if (!p.onsiteAllowed) rejectedBy.push("onsite_not_allowed"); }

  if (p.employmentTypes.length && job.employmentType && !p.employmentTypes.map(normalize).includes(normalize(job.employmentType))) {
    rejectedBy.push("employment_type");
  }
  if (p.minimumSalary && job.salaryMax && job.salaryMax < p.minimumSalary) rejectedBy.push("salary_below_minimum");
  if (p.seniorityLevels.length && job.seniority && !p.seniorityLevels.map(normalize).includes(normalize(job.seniority))) {
    rejectedBy.push("seniority");
  }
  if (job.companyName && p.excludedCompanies.map(normalize).includes(normalize(job.companyName))) rejectedBy.push("excluded_company");

  const localOnly = !p.internationalRemote && !remote.includes("remot");
  if (localOnly && p.targetLocations.length && job.location) {
    const matches = p.targetLocations.some((loc) => normalize(job.location).includes(normalize(loc)));
    if (!matches && !p.willingToRelocate) rejectedBy.push("location");
  }

  return { passed: rejectedBy.length === 0, rejectedBy };
}

/** STAGE 2 — cheap lexical/semantic relevance over role, skills and description. */
export function relevanceScore(job: JobRecord, profile: MasterProfile) {
  const jobText = new Set([...tokens(job.title), ...tokens(job.description)]);
  const roleHit = profile.preferences.targetRoles.some((role) => tokens(role).some((t) => jobText.has(t)));
  const roleScore = roleHit ? 100 : profile.identity.currentTitle && tokens(profile.identity.currentTitle).some((t) => jobText.has(t)) ? 70 : 35;

  const skillNames = profile.skills.map((s) => normalize(s.name));
  const skillHits = skillNames.filter((name) => tokens(name).some((t) => jobText.has(t)));
  const skillsScore = skillNames.length ? Math.round((skillHits.length / Math.min(skillNames.length, 8)) * 100) : 0;

  return { roleScore, skillsScore: Math.min(skillsScore, 100), matchedSkills: skillHits };
}

/** STAGE 3 — detailed scoring, only for jobs that survived stages 1 and 2. */
export function scoreJob(job: JobRecord, profile: MasterProfile): MatchBreakdown {
  const hard = passesHardFilters(job, profile);
  const { roleScore, skillsScore, matchedSkills } = relevanceScore(job, profile);

  const monthsOfExperience = profile.experience.reduce((total, exp) => {
    if (!exp.startDate) return total;
    const start = new Date(exp.startDate).getTime();
    const end = exp.endDate ? new Date(exp.endDate).getTime() : Date.now();
    return total + Math.max(0, (end - start) / (1000 * 60 * 60 * 24 * 30));
  }, 0);
  const experienceScore = Math.min(100, Math.round((monthsOfExperience / 48) * 100));

  const remote = normalize(job.remoteType);
  const locationScore = remote.includes("remot")
    ? profile.preferences.remoteAllowed ? 100 : 40
    : profile.preferences.targetLocations.some((loc) => normalize(job.location).includes(normalize(loc))) ? 95 : 55;

  const seniorityScore = !job.seniority || !profile.preferences.seniorityLevels.length
    ? 70
    : profile.preferences.seniorityLevels.map(normalize).includes(normalize(job.seniority)) ? 100 : 45;

  const preferredIndustryHit = profile.preferences.preferredIndustries.length === 0
    ? 70
    : profile.preferences.preferredIndustries.some((ind) => normalize(job.description).includes(normalize(ind))) ? 100 : 60;

  const matchScore = Math.round(
    roleScore * 0.3 + skillsScore * 0.25 + experienceScore * 0.15 + locationScore * 0.12 + seniorityScore * 0.1 + preferredIndustryHit * 0.08,
  );

  const fit: string[] = [];
  if (roleScore >= 70) fit.push("Coincide con el rol que buscás");
  if (matchedSkills.length) fit.push(`Habilidades en común: ${matchedSkills.slice(0, 4).join(", ")}`);
  if (remote.includes("remot") && profile.preferences.remoteAllowed) fit.push("Compatible con trabajo remoto");

  const concerns: string[] = [];
  if (experienceScore < 60) concerns.push("Tu experiencia acumulada es menor a la habitual para este puesto.");
  if (seniorityScore < 60) concerns.push("El seniority del puesto no coincide exactamente con tus preferencias.");

  return {
    matchScore: Math.max(0, Math.min(100, matchScore)),
    roleScore,
    skillsScore,
    experienceScore,
    locationScore,
    seniorityScore,
    preferencesScore: preferredIndustryHit,
    hardRequirementsMet: hard.passed,
    explanation: { fit, concerns, rejectedBy: hard.rejectedBy },
  };
}

/** Match score = profile match. Never a hiring probability. */
export const MATCH_SCORE_MEANING = "profile_match";
