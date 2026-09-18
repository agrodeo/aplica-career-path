import { validateResumeAgainstProfile, type StructuredResume, type ValidationOutcome } from "./truthfulness";
import { relevanceScore } from "./matching";
import type { JobRecord, MasterProfile } from "./types";

export interface ResumeVariantDraft {
  structuredResume: StructuredResume;
  professionalSummary: string;
  selectedExperienceIds: string[];
  selectedSkillIds: string[];
  generatedBullets: { experienceId: string; bullets: string[] }[];
  html: string;
  validation: ValidationOutcome;
}

/**
 * Builds a job-specific CV variant from MasterProfile facts only:
 * relevant experience is selected and reordered, relevant skills are picked,
 * and the summary is rewritten from the user's own summary and titles.
 * No new employer, date, degree, skill or metric is ever introduced.
 */
export function buildResumeVariant(job: JobRecord, profile: MasterProfile): ResumeVariantDraft {
  const { matchedSkills } = relevanceScore(job, profile);
  const jobText = `${job.title} ${job.description ?? ""}`.toLowerCase();

  const rankedExperience = [...profile.experience].sort((a, b) => {
    const score = (exp: typeof a) => {
      const titleHit = jobText.includes(exp.title.toLowerCase()) ? 2 : 0;
      const recency = exp.isCurrent ? 1 : 0;
      return titleHit + recency;
    };
    const diff = score(b) - score(a);
    if (diff !== 0) return diff;
    return (b.startDate ?? "").localeCompare(a.startDate ?? "");
  });

  const selectedSkills = profile.skills.filter((s) => matchedSkills.includes(s.name.toLowerCase()));
  const skills = (selectedSkills.length ? selectedSkills : profile.skills.slice(0, 8)).map((s) => s.name);

  const summarySource = profile.identity.professionalSummary || `${profile.identity.currentTitle}`;
  const professionalSummary = summarySource
    ? `${summarySource.trim().replace(/\s+/g, " ")}`
    : `${profile.identity.currentTitle} con experiencia en ${skills.slice(0, 3).join(", ")}.`;

  const structuredResume: StructuredResume = {
    professionalSummary,
    experience: rankedExperience.map((exp) => ({
      experienceId: exp.id,
      company: exp.company,
      title: exp.title,
      startDate: exp.startDate,
      endDate: exp.endDate,
      // Bullets are the user's own achievements and description sentences, reordered only.
      bullets: [...exp.achievements, ...splitSentences(exp.description)].filter(Boolean).slice(0, 4),
    })),
    education: profile.education.map((edu) => ({ educationId: edu.id, institution: edu.institution, degree: edu.degree, field: edu.field })),
    skills,
    languages: profile.languages.map((l) => ({ language: l.language, level: l.level })),
  };

  const validation = validateResumeAgainstProfile(structuredResume, profile);

  return {
    structuredResume,
    professionalSummary,
    selectedExperienceIds: rankedExperience.map((e) => e.id),
    selectedSkillIds: (selectedSkills.length ? selectedSkills : profile.skills.slice(0, 8)).map((s) => s.id),
    generatedBullets: structuredResume.experience.map((e) => ({ experienceId: e.experienceId, bullets: e.bullets })),
    html: renderAtsHtml(structuredResume, profile),
    validation,
  };
}

function splitSentences(text: string) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);
}

function escape(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** ATS-friendly single column template: no graphics, columns, bars or photos. */
export function renderAtsHtml(resume: StructuredResume, profile: MasterProfile): string {
  const { identity, links } = profile;
  const contact = [identity.email, identity.phone, [identity.city, identity.country].filter(Boolean).join(", "), links.linkedin, links.portfolio]
    .filter(Boolean)
    .map(escape)
    .join(" · ");

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escape(`${identity.firstName} ${identity.lastName}`)}</title>
<style>
body{font-family:Georgia,'Times New Roman',serif;font-size:11pt;line-height:1.4;color:#111;margin:40px;max-width:720px}
h1{font-size:17pt;margin:0 0 4px}h2{font-size:11pt;text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid #111;padding-bottom:3px;margin:22px 0 10px}
p{margin:0 0 8px}ul{margin:4px 0 12px 18px;padding:0}li{margin-bottom:3px}
.meta{font-size:9.5pt;color:#333}.role{font-weight:bold}.dates{float:right;font-size:9.5pt;color:#333}
</style></head><body>
<h1>${escape(`${identity.firstName} ${identity.lastName}`)}</h1>
<p class="meta">${escape(identity.currentTitle)}</p>
<p class="meta">${contact}</p>
<h2>Resumen profesional</h2><p>${escape(resume.professionalSummary)}</p>
<h2>Experiencia</h2>
${resume.experience
  .map(
    (exp) => `<div><span class="dates">${escape(formatRange(exp.startDate, exp.endDate))}</span><span class="role">${escape(exp.title)}</span> — ${escape(exp.company)}
<ul>${exp.bullets.map((b) => `<li>${escape(b)}</li>`).join("")}</ul></div>`,
  )
  .join("")}
<h2>Educación</h2>
${resume.education.map((edu) => `<p>${escape([edu.degree, edu.field].filter(Boolean).join(", "))} — ${escape(edu.institution)}</p>`).join("")}
<h2>Habilidades</h2><p>${resume.skills.map(escape).join(" · ")}</p>
<h2>Idiomas</h2><p>${resume.languages.map((l) => escape(`${l.language} (${l.level})`)).join(" · ")}</p>
</body></html>`;
}

function formatRange(start: string | null, end: string | null) {
  const fmt = (value: string | null) => (value ? value.slice(0, 7) : "Actual");
  return `${fmt(start)} — ${end ? fmt(end) : "Actual"}`;
}
