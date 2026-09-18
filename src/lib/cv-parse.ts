import { skills as skillOptions } from "./aplica-data";

export type CvFields = {
  firstName: string; lastName: string; email: string; phone: string; country: string; city: string;
  company: string; role: string; start: string; end: string; description: string; achievements: string;
  institution: string; degree: string; area: string; studyDates: string; language: string; level: string;
};

export type CvResult = { fields: Partial<CvFields>; skills: string[]; text: string };

const countries = ["Argentina", "México", "Colombia", "Chile", "Uruguay", "Perú", "Brasil", "España"];
const cities = ["Buenos Aires", "Córdoba", "Rosario", "Ciudad de México", "Guadalajara", "Monterrey", "Bogotá", "Medellín", "Santiago", "Montevideo", "Lima", "São Paulo", "Madrid"];
const roleWords = /(manager|analyst|analista|developer|desarrollador|engineer|ingenier|designer|diseñador|lead|marketing|growth|product|data|sales|ventas|consultor|specialist|especialista|coordinador|director|intern|pasant)/i;
const sectionHeadingWords = /^(work|professional|employment|career)?\s*experience$|^experiencia(\s+(laboral|profesional))?$|^education$|^educaci[oó]n$|^skills?$|^habilidades$|^languages?$|^idiomas$|^summary$|^profile$|^perfil$|^contact$|^contacto$|^projects?$|^proyectos$|^certifications?$|^certificaciones$|^achievements?$|^logros$|^about(\s+me)?$|^sobre\s+m[ií]$/i;
const nameStopWords = new Set([
  "work",
  "experience",
  "professional",
  "employment",
  "career",
  "education",
  "skills",
  "languages",
  "summary",
  "profile",
  "contact",
  "projects",
  "certifications",
  "achievements",
  "experiencia",
  "laboral",
  "profesional",
  "educacion",
  "educación",
  "habilidades",
  "idiomas",
  "perfil",
  "contacto",
  "proyectos",
  "certificaciones",
  "logros",
]);
const degreeWords = /(licenciatura|licenciado|ingeniería|ingeniero|técnico|tecnicatura|abogac|contador|magíster|maestría|master|mba|bachelor|diplomatura|secundario)/i;
const eduWords = /(universidad|universitario|instituto|facultad|escuela|colegio|utn|uba|itba|tec de monterrey|university)/i;
const dateRange = /((?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic|jan|apr|aug|dec)[a-z]*\.?\s*\d{4}|\d{1,2}\/\d{4}|\d{4})\s*(?:-|–|—|a|to|hasta)\s*(actualidad|presente|present|current|hoy|(?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic|jan|apr|aug|dec)[a-z]*\.?\s*\d{4}|\d{1,2}\/\d{4}|\d{4})/i;

async function extractPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];
  for (let index = 1; index <= Math.min(pdf.numPages, 8); index += 1) {
    const page = await pdf.getPage(index);
    const content = await page.getTextContent();
    let line = "";
    let lastY: number | null = null;
    const lines: string[] = [];
    for (const item of content.items as Array<{ str?: string; transform?: number[] }>) {
      if (typeof item.str !== "string") continue;
      const y = item.transform?.[5] ?? null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 3) { lines.push(line.trim()); line = ""; }
      line += item.str + " ";
      lastY = y;
    }
    lines.push(line.trim());
    pages.push(lines.join("\n"));
  }
  return pages.join("\n");
}

async function extractDocx(file: File): Promise<string> {
  const mammoth = await import("mammoth/mammoth.browser.js");
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return result.value ?? "";
}

export async function extractCvText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return extractPdf(file);
  if (name.endsWith(".docx")) return extractDocx(file);
  return file.text();
}

export function parseCvText(raw: string): CvResult {
  const text = raw.replace(/\r/g, "");
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const fields: Partial<CvFields> = {};

  const email = text.match(/[\w.+-]+@[\w-]+\.[\w.]{2,}/)?.[0];
  if (email) fields.email = email;
  const phone = text.match(/(\+?\d[\d\s().-]{7,17}\d)/)?.[0];
  if (phone) fields.phone = phone.trim();

  const nameLine = lines.slice(0, 12).find(isLikelyPersonName);
  if (nameLine) {
    const words = normalizePersonName(nameLine);
    fields.firstName = words[0] ?? "";
    fields.lastName = words.slice(1).join(" ");
  } else if (email) {
    const local = email.split("@")[0] ?? "";
    const emailName = local
      .replace(/[._-]+/g, " ")
      .replace(/\d+/g, " ")
      .trim();
    const emailWords = emailName.split(/\s+/).filter(Boolean);
    if (
      emailWords.length === 1 &&
      /^[\p{L}][\p{L}'-]{1,}$/u.test(emailWords[0]) &&
      !nameStopWords.has(
        emailWords[0]
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase(),
      )
    ) {
      fields.firstName = normalizePersonName(emailWords[0])[0];
    } else if (
      emailName &&
      isLikelyPersonName(emailName, { allowLowercase: true })
    ) {
      const words = normalizePersonName(emailName);
      fields.firstName = words[0] ?? "";
      if (words.length > 1) fields.lastName = words.slice(1).join(" ");
    }
  }

  const country = countries.find((item) => new RegExp(item, "i").test(text));
  if (country) fields.country = country;
  const city = cities.find((item) => new RegExp(item, "i").test(text));
  if (city) fields.city = city;

  const roleIndex = lines.findIndex((line) => line.length <= 60 && roleWords.test(line) && !/@/.test(line));
  if (roleIndex >= 0) {
    fields.role = (lines[roleIndex] ?? "").replace(/\s*[|·–-]\s*.*$/, "").trim();
    const context = lines.slice(roleIndex, roleIndex + 5);
    const companyLine = context.slice(1).find((line) => line.length <= 60 && !dateRange.test(line) && !/@|\d{4}/.test(line));
    if (companyLine) fields.company = companyLine.replace(/^(en|at)\s+/i, "").trim();
    const range = context.join(" ").match(dateRange);
    if (range) {
      const from = (range[1] ?? "").trim();
      const to = (range[2] ?? "").trim();
      fields.start = from;
      fields.end = /actualidad|presente|present|current|hoy/i.test(to) ? "Actualidad" : to;
    }
    const description = lines.slice(roleIndex + 1, roleIndex + 8).find((line) => line.length > 60);
    if (description) fields.description = description;
    const achievement = lines.slice(roleIndex + 1, roleIndex + 12).find((line) => line.length > 40 && /\d+\s*%|aument|reduj|redu|creci|logr|increment|ahorr/i.test(line));
    if (achievement) fields.achievements = achievement;
  }

  const institutionLine = lines.find((line) => line.length <= 80 && eduWords.test(line));
  if (institutionLine) {
    fields.institution = institutionLine.replace(/\s*[|·–-]\s*.*$/, "").trim();
    const index = lines.indexOf(institutionLine);
    const around = lines.slice(Math.max(0, index - 2), index + 4);
    const degreeLine = around.find((line) => degreeWords.test(line));
    if (degreeLine) fields.degree = degreeLine.replace(/\s*[|·–-]\s*.*$/, "").trim();
    const range = around.join(" ").match(dateRange);
    if (range) {
      const from = (range[1] ?? "").trim();
      const to = (range[2] ?? "").trim();
      fields.studyDates = `${from} — ${/actualidad|presente|present|current/i.test(to) ? "Actualidad" : to}`;
    }
  }

  if (/español|spanish|castellano/i.test(text)) { fields.language = "Español"; fields.level = "Nativo"; }

  const found = skillOptions.filter((skill) => new RegExp(`(^|[^\\p{L}])${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}]|$)`, "iu").test(text));
  return { fields, skills: found, text };
}

function normalizePersonName(line: string) {
  return line
    .trim()
    .split(/\s+/)
    .map((word) => {
      const lower = word.toLocaleLowerCase("es");
      if (/^(de|del|la|las|los|da|do|dos|van|von)$/i.test(lower)) {
        return lower;
      }
      return lower.replace(
        /(^|[-'])[\p{L}]/gu,
        (letter) => letter.toLocaleUpperCase("es"),
      );
    });
}

function isLikelyPersonName(
  line: string,
  options: { allowLowercase?: boolean } = {},
) {
  const candidate = line.trim();
  if (!candidate || candidate.length > 60) return false;
  if (/\d|@|https?:\/\/|www\.|linkedin/i.test(candidate)) return false;
  if (sectionHeadingWords.test(candidate)) return false;
  if (roleWords.test(candidate) || eduWords.test(candidate)) return false;

  const words = candidate.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 5) return false;

  const normalized = words.map((word) =>
    word
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z'-]/g, ""),
  );
  if (normalized.some((word) => nameStopWords.has(word))) return false;

  const connectors = /^(de|del|la|las|los|da|do|dos|van|von)$/i;
  const wordLooksLikeName = (word: string) => {
    if (connectors.test(word)) return true;
    if (options.allowLowercase) {
      return /^[\p{L}][\p{L}'.-]{1,}$/u.test(word);
    }
    return (
      /^[A-ZÁÉÍÓÚÑ][\p{L}'.-]{1,}$/u.test(word) ||
      /^[A-ZÁÉÍÓÚÑ]{2,}$/u.test(word)
    );
  };

  if (!words.every(wordLooksLikeName)) return false;

  // Generic headings often appear in title case and can otherwise look
  // exactly like a person's name. Requiring at least one word that is not a
  // common resume/navigation term prevents cases such as "Work Experience".
  return normalized.some((word) => !nameStopWords.has(word));
}

export async function parseCvFile(file: File): Promise<CvResult> {
  const text = await extractCvText(file);
  return parseCvText(text);
}
