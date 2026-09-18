import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RESUME_BUCKET } from "../config.js";
import { db } from "../supabase.js";
import { withIsolatedPage } from "../browser/context.js";
import { ApplicationError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import type { JobRecord, MasterProfile } from "../adapters/types.js";

interface StructuredResume {
  professionalSummary: string;
  experience: { experienceId: string; company: string; title: string; startDate: string | null; endDate: string | null; bullets: string[] }[];
  education: { educationId: string; institution: string; degree: string; field: string }[];
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
 * Job-specific CV: selects relevant experience and skills from MasterProfile,
 * reorders them, rewords nothing beyond the user's own text, validates every
 * factual claim against MasterProfile, then renders one-column ATS-safe HTML
 * and prints it to PDF. Cached by user + job + master_profile_version.
 */
export async function getOrCreateResume(job: JobRecord, profile: MasterProfile): Promise<ResumeArtifact> {
  const supabase = db();
  const { data: cached } = await supabase
    .from("resume_variants")
    .select("id, pdf_path, structured_resume, validation_status")
    .eq("user_id", profile.userId)
    .eq("job_id", job.id)
    .eq("master_profile_version", profile.masterProfileVersion)
    .maybeSingle();

  if (cached?.pdf_path && cached.validation_status === "passed") {
    const localPath = await downloadResume(cached.pdf_path);
    return { resumeVariantId: cached.id, pdfPath: cached.pdf_path, localPath, structuredResume: cached.structured_resume as StructuredResume };
  }

  const structured = buildStructuredResume(job, profile);
  const validation = validateAgainstProfile(structured, profile);
  if (!validation.passed) {
    throw new ApplicationError("UNSUPPORTED_FIELD", `Resume validation failed: ${validation.issues.join("; ")}`);
  }

  const html = renderAtsHtml(structured, profile);
  const pdf = await htmlToPdf(html);
  const pdfPath = `${profile.userId}/${job.id}-v${profile.masterProfileVersion}.pdf`;

  const upload = await supabase.storage.from(RESUME_BUCKET).upload(pdfPath, pdf, { contentType: "application/pdf", upsert: true });
  if (upload.error) throw new ApplicationError("FILE_UPLOAD_FAILED", upload.error.message);

  const { data: saved, error } = await supabase
    .from("resume_variants")
    .upsert(
      {
        user_id: profile.userId,
        job_id: job.id,
        master_profile_version: profile.masterProfileVersion,
        structured_resume: structured as unknown as Record<string, unknown>,
        professional_summary: structured.professionalSummary,
        selected_experience_ids: structured.experience.map((e) => e.experienceId),
        generated_bullets: structured.experience.map((e) => ({ experienceId: e.experienceId, bullets: e.bullets })),
        html,
        pdf_path: pdfPath,
        validation_status: "passed",
        validation_issues: [],
      },
      { onConflict: "user_id,job_id,master_profile_version" },
    )
    .select("id")
    .single();
  if (error) throw new ApplicationError("UNKNOWN_ERROR", error.message);

  const localPath = await writeTemp(pdf, `${job.id}.pdf`);
  logger.info({ jobId: job.id }, "resume variant generated");
  return { resumeVariantId: saved.id, pdfPath, localPath, structuredResume: structured };
}

function buildStructuredResume(job: JobRecord, profile: MasterProfile): StructuredResume {
  const jobText = `${job.title} ${job.description}`.toLowerCase();
  const relevantSkills = profile.skills.filter((s) => jobText.includes(s.name.toLowerCase()));
  const skills = (relevantSkills.length ? relevantSkills : profile.skills.slice(0, 8)).map((s) => s.name);

  const experience = [...profile.experience]
    .sort((a, b) => {
      const score = (exp: (typeof profile.experience)[number]) => (jobText.includes(exp.title.toLowerCase()) ? 2 : 0) + (exp.isCurrent ? 1 : 0);
      const diff = score(b) - score(a);
      return diff !== 0 ? diff : (b.startDate ?? "").localeCompare(a.startDate ?? "");
    })
    .map((exp) => ({
      experienceId: exp.id,
      company: exp.company,
      title: exp.title,
      startDate: exp.startDate,
      endDate: exp.endDate,
      bullets: [...exp.achievements, ...splitSentences(exp.description)].filter(Boolean).slice(0, 4),
    }));

  return {
    professionalSummary: profile.identity.professionalSummary || `${profile.identity.currentTitle}`,
    experience,
    education: profile.education.map((e) => ({ educationId: e.id, institution: e.institution, degree: e.degree, field: e.field })),
    skills,
    languages: profile.languages,
  };
}

function validateAgainstProfile(resume: StructuredResume, profile: MasterProfile): { passed: boolean; issues: string[] } {
  const issues: string[] = [];
  const sourceText = [profile.identity.professionalSummary, ...profile.experience.flatMap((e) => [e.description, ...e.achievements])].join(" ").toLowerCase();

  for (const exp of resume.experience) {
    const source = profile.experience.find((e) => e.id === exp.experienceId);
    if (!source) {
      issues.push(`unknown employer ${exp.company}`);
      continue;
    }
    if (source.company !== exp.company || source.title !== exp.title) issues.push(`altered employer/title for ${exp.company}`);
    if ((source.startDate ?? null) !== exp.startDate || (source.endDate ?? null) !== exp.endDate) issues.push(`altered dates for ${exp.company}`);
    for (const bullet of exp.bullets) {
      if (!sourceText.includes(bullet.toLowerCase().slice(0, 40))) issues.push(`unsupported bullet: ${bullet.slice(0, 40)}`);
    }
  }
  for (const skill of resume.skills) {
    if (!profile.skills.some((s) => s.name === skill)) issues.push(`unknown skill ${skill}`);
  }
  for (const edu of resume.education) {
    if (!profile.education.some((e) => e.id === edu.educationId)) issues.push(`unknown education ${edu.institution}`);
  }
  return { passed: issues.length === 0, issues };
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

/** One column, no graphics, no skill bars, no photo, no decorative icons. */
export function renderAtsHtml(resume: StructuredResume, profile: MasterProfile): string {
  const { identity, links } = profile;
  const contact = [identity.email, identity.phone, [identity.city, identity.country].filter(Boolean).join(", "), links.linkedin, links.portfolio]
    .filter(Boolean)
    .map(escape)
    .join(" · ");

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escape(`${identity.firstName} ${identity.lastName}`)}</title>
<style>
@page { margin: 18mm; }
body{font-family:Georgia,'Times New Roman',serif;font-size:11pt;line-height:1.4;color:#111;margin:0}
h1{font-size:17pt;margin:0 0 4px}
h2{font-size:11pt;text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid #111;padding-bottom:3px;margin:20px 0 10px}
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
    (exp) => `<div><span class="dates">${escape(range(exp.startDate, exp.endDate))}</span><span class="role">${escape(exp.title)}</span> — ${escape(exp.company)}
<ul>${exp.bullets.map((b) => `<li>${escape(b)}</li>`).join("")}</ul></div>`,
  )
  .join("")}
<h2>Educación</h2>
${resume.education.map((edu) => `<p>${escape([edu.degree, edu.field].filter(Boolean).join(", "))} — ${escape(edu.institution)}</p>`).join("")}
<h2>Habilidades</h2><p>${resume.skills.map(escape).join(" · ")}</p>
<h2>Idiomas</h2><p>${resume.languages.map((l) => escape(`${l.language} (${l.level})`)).join(" · ")}</p>
</body></html>`;
}

function range(start: string | null, end: string | null) {
  const fmt = (value: string | null) => (value ? value.slice(0, 7) : "Actual");
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

async function downloadResume(pdfPath: string): Promise<string> {
  const { data, error } = await db().storage.from(RESUME_BUCKET).download(pdfPath);
  if (error || !data) throw new ApplicationError("FILE_UPLOAD_FAILED", error?.message ?? "Could not download the cached CV.");
  return writeTemp(Buffer.from(await data.arrayBuffer()), pdfPath.split("/").pop() ?? "cv.pdf");
}
