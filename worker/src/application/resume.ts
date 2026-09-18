import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createUpload, saveResumeVariant, uploadToGrant } from "../api.js";
import { withIsolatedPage } from "../browser/context.js";
import { ApplicationError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { tailorResumeCopy } from "./tailor.js";
import type { JobRecord, MasterProfile, ResumeFact } from "../adapters/types.js";

interface StructuredResume {
  professionalSummary: string;
  professionalSummarySourceFactIds: string[];
  generationModel: string | null;
  experience: {
    experienceId: string;
    company: string;
    title: string;
    startDate: string | null;
    endDate: string | null;
    bullets: string[];
    bulletSourceFactIds: string[][];
  }[];
  education: {
    educationId: string;
    institution: string;
    degree: string;
    field: string;
  }[];
  skills: string[];
  languages: { language: string; level: string }[];
}

export interface ResumeArtifact {
  resumeVariantId: string;
  pdfPath: string;
  localPath: string;
  structuredResume: StructuredResume;
}

/**
 * Produces a truthful ATS-safe resume locally, uploads it through a short-lived
 * signed URL, then asks the backend to persist the resume variant. The worker
 * never receives Supabase/database credentials.
 */
export async function getOrCreateResume(
  job: JobRecord,
  profile: MasterProfile,
  applicationAttemptId: string,
): Promise<ResumeArtifact> {
  const structured = await buildStructuredResume(job, profile);
  const validation = validateAgainstProfile(structured, profile);
  if (!validation.passed) {
    throw new ApplicationError(
      "UNSUPPORTED_FIELD",
      `Resume validation failed: ${validation.issues.join("; ")}`,
    );
  }

  const html = renderAtsHtml(structured, profile);
  const pdf = await htmlToPdf(html);
  const localPath = await writeTemp(pdf, `${job.id}.pdf`);

  const grant = await createUpload(applicationAttemptId, "resume", "application/pdf");
  const pdfPath = await uploadToGrant(grant, pdf);

  const saved = await saveResumeVariant({
    application_attempt_id: applicationAttemptId,
    pdf_path: pdfPath,
    structured_resume: structured,
    professional_summary: structured.professionalSummary,
    selected_experience_ids: structured.experience.map((e) => e.experienceId),
    selected_skill_ids: profile.skills
      .filter((skill) => structured.skills.includes(skill.name))
      .map((skill) => skill.id),
    generated_bullets: structured.experience.map((e) => ({
      experienceId: e.experienceId,
      bullets: e.bullets,
    })),
    html,
    generation_model: structured.generationModel,
    validation_status: "passed",
    validation_issues: [],
    master_profile_version: profile.masterProfileVersion,
  });

  logger.info({ jobId: job.id, resumeVariantId: saved.id }, "resume variant generated");
  return {
    resumeVariantId: saved.id,
    pdfPath,
    localPath,
    structuredResume: structured,
  };
}

async function buildStructuredResume(
  job: JobRecord,
  profile: MasterProfile,
): Promise<StructuredResume> {
  const jobText = `${job.title} ${job.description}`.toLowerCase();
  const relevantSkills = profile.skills.filter((skill) =>
    jobText.includes(skill.name.toLowerCase()),
  );
  const skills = (relevantSkills.length
    ? relevantSkills
    : profile.skills.slice(0, 8)
  ).map((skill) => skill.name);

  const baseExperience = [...profile.experience]
    .sort((a, b) => {
      const score = (experience: (typeof profile.experience)[number]) =>
        (jobText.includes(experience.title.toLowerCase()) ? 2 : 0) +
        (experience.isCurrent ? 1 : 0);
      const diff = score(b) - score(a);
      return diff !== 0
        ? diff
        : (b.startDate ?? "").localeCompare(a.startDate ?? "");
    })
    .map((experience) => ({
      experienceId: experience.id,
      company: experience.company,
      title: experience.title,
      startDate: experience.startDate,
      endDate: experience.endDate,
      bullets: [
        ...experience.achievements,
        ...splitSentences(experience.description),
      ]
        .filter(Boolean)
        .slice(0, 4),
      bulletSourceFactIds: [] as string[][],
    }));

  const tailored = await tailorResumeCopy(job, profile);
  const tailoredByExperience = new Map(
    tailored?.experiences.map((experience) => [
      experience.experienceId,
      experience.bullets,
    ]) ?? [],
  );

  const experience = baseExperience.map((base) => {
    const generated = tailoredByExperience.get(base.experienceId);
    if (!generated?.length) {
      return {
        ...base,
        bulletSourceFactIds: base.bullets.map(() => []),
      };
    }

    return {
      ...base,
      bullets: generated.map((bullet) => bullet.text),
      bulletSourceFactIds: generated.map((bullet) => bullet.sourceFactIds),
    };
  });

  const summary =
    tailored?.summary?.trim() ||
    profile.identity.professionalSummary ||
    profile.identity.currentTitle;

  return {
    professionalSummary: summary,
    professionalSummarySourceFactIds:
      tailored?.summarySourceFactIds ?? [],
    generationModel: tailored?.model ?? null,
    experience,
    education: profile.education.map((education) => ({
      educationId: education.id,
      institution: education.institution,
      degree: education.degree,
      field: education.field,
    })),
    skills,
    languages: profile.languages,
  };
}

function validateAgainstProfile(
  resume: StructuredResume,
  profile: MasterProfile,
): { passed: boolean; issues: string[] } {
  const issues: string[] = [];

  if (resume.generationModel) {
    const summaryFacts = resume.professionalSummarySourceFactIds
      .map((id) => profile.facts.find((fact) => fact.id === id))
      .filter((fact): fact is ResumeFact => Boolean(fact));
    if (
      !summaryFacts.length ||
      summaryFacts.length !== resume.professionalSummarySourceFactIds.length ||
      summaryFacts.some(
        (fact) => !fact.userConfirmed || !fact.allowedForResume,
      ) ||
      !factBackedSentenceIsSafe(resume.professionalSummary, summaryFacts)
    ) {
      issues.push("generated professional summary is not fully fact-backed");
    }
  }

  for (const exp of resume.experience) {
    const source = profile.experience.find((e) => e.id === exp.experienceId);
    if (!source) {
      issues.push(`unknown employer ${exp.company}`);
      continue;
    }
    if (source.company !== exp.company || source.title !== exp.title) {
      issues.push(`altered employer/title for ${exp.company}`);
    }
    if (
      (source.startDate ?? null) !== exp.startDate ||
      (source.endDate ?? null) !== exp.endDate
    ) {
      issues.push(`altered dates for ${exp.company}`);
    }

    const sourceBullets = new Set(
      [...source.achievements, ...splitSentences(source.description)]
        .map((value) => value.trim())
        .filter(Boolean),
    );
    for (const [index, bullet] of exp.bullets.entries()) {
      if (sourceBullets.has(bullet)) continue;

      const factIds = exp.bulletSourceFactIds[index] ?? [];
      const facts = factIds
        .map((id) => profile.facts.find((fact) => fact.id === id))
        .filter((fact): fact is ResumeFact => Boolean(fact));

      if (
        !factIds.length ||
        facts.length !== factIds.length ||
        facts.some(
          (fact) => !fact.userConfirmed || !fact.allowedForResume,
        ) ||
        !factBackedSentenceIsSafe(bullet, facts)
      ) {
        issues.push(`unsupported bullet: ${bullet.slice(0, 60)}`);
      }
    }
  }

  for (const skill of resume.skills) {
    if (!profile.skills.some((s) => s.name === skill)) {
      issues.push(`unknown skill ${skill}`);
    }
  }
  for (const edu of resume.education) {
    if (!profile.education.some((e) => e.id === edu.educationId)) {
      issues.push(`unknown education ${edu.institution}`);
    }
  }

  return { passed: issues.length === 0, issues };
}

function factBackedSentenceIsSafe(
  text: string,
  facts: ResumeFact[],
) {
  const supported = facts.map((fact) => fact.claim).join(" ");
  const supportedNumbers = new Set(numericTokens(supported));
  return numericTokens(text).every((number) => supportedNumbers.has(number));
}

function numericTokens(value: string) {
  return value.match(/\b\d+(?:[.,]\d+)?%?\b/g) ?? [];
}

function splitSentences(text: string) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);
}

function escape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** One column, no graphics, skill bars, photo, or decorative icons. */
export function renderAtsHtml(
  resume: StructuredResume,
  profile: MasterProfile,
): string {
  const { identity, links } = profile;
  const contact = [
    identity.email,
    identity.phone,
    [identity.city, identity.country].filter(Boolean).join(", "),
    links.linkedin,
    links.portfolio,
  ]
    .filter(Boolean)
    .map(escape)
    .join(" · ");

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escape(
    `${identity.firstName} ${identity.lastName}`,
  )}</title>
<style>
@page { margin: 18mm; }
body{font-family:Arial,Helvetica,sans-serif;font-size:10.5pt;line-height:1.4;color:#111;margin:0}
h1{font-size:17pt;margin:0 0 4px}
h2{font-size:11pt;text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid #111;padding-bottom:3px;margin:18px 0 9px}
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
    (exp) =>
      `<div><span class="dates">${escape(range(exp.startDate, exp.endDate))}</span><span class="role">${escape(exp.title)}</span> — ${escape(exp.company)}
<ul>${exp.bullets.map((b) => `<li>${escape(b)}</li>`).join("")}</ul></div>`,
  )
  .join("")}
<h2>Educación</h2>
${resume.education
  .map(
    (edu) =>
      `<p>${escape([edu.degree, edu.field].filter(Boolean).join(", "))} — ${escape(edu.institution)}</p>`,
  )
  .join("")}
<h2>Habilidades</h2><p>${resume.skills.map(escape).join(" · ")}</p>
<h2>Idiomas</h2><p>${resume.languages
  .map((l) => escape(`${l.language} (${l.level})`))
  .join(" · ")}</p>
</body></html>`;
}

function range(start: string | null, end: string | null) {
  const fmt = (value: string | null) =>
    value ? value.slice(0, 7) : "Actual";
  return `${fmt(start)} — ${end ? fmt(end) : "Actual"}`;
}

async function htmlToPdf(html: string): Promise<Buffer> {
  return withIsolatedPage(async (page) => {
    await page.setContent(html, { waitUntil: "load" });
    return page.pdf({ format: "A4", printBackground: false });
  });
}

async function writeTemp(bytes: Buffer, name: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "aplica-cv-"));
  const path = join(dir, name);
  await writeFile(path, bytes);
  return path;
}
