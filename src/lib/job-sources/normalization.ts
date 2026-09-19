const HTML_ENTITY_MAP: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

export function decodeEntities(value: string) {
  return value.replace(
    /&(?:amp|lt|gt|quot|#39|apos|nbsp);/g,
    (entity) => HTML_ENTITY_MAP[entity] ?? entity,
  );
}

export function toPlainText(value: string | null | undefined) {
  let decoded = value ?? "";
  for (let i = 0; i < 2; i += 1) decoded = decodeEntities(decoded);
  return decoded
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function inferRemoteType(
  title: string,
  location: string | null | undefined,
  description: string,
  explicit?: string | null,
) {
  const direct = (explicit ?? "").toLowerCase();
  if (/remote|remoto/.test(direct)) return "remote";
  if (/hybrid|híbrido|hibrido/.test(direct)) return "hybrid";
  if (/onsite|on-site|office|presencial/.test(direct)) return "onsite";

  const text = `${title} ${location ?? ""} ${description.slice(0, 1600)}`.toLowerCase();
  if (/\bremote\b|\bremoto\b|work from home|distributed team/.test(text)) {
    return "remote";
  }
  if (/\bhybrid\b|\bhíbrido\b|\bhibrido\b/.test(text)) return "hybrid";
  if (/\bon[- ]?site\b|\bpresencial\b|in[- ]office/.test(text)) return "onsite";
  return null;
}

export function inferEmploymentType(
  title: string,
  description: string,
  explicit?: string | null,
) {
  const text = `${explicit ?? ""} ${title} ${description.slice(0, 1600)}`.toLowerCase();
  if (/\bintern(ship)?\b|\bpasant/.test(text)) return "internship";
  if (/\bpart[- ]?time\b/.test(text)) return "part-time";
  if (/\bcontract(or)?\b|\bfreelance\b|\btemporary\b/.test(text)) return "contract";
  return "full-time";
}

export function inferSeniority(title: string) {
  const value = title.toLowerCase();
  if (/\bchief\b|\bc[tef]o\b|\bvp\b|vice president/.test(value)) return "executive";
  if (/\bdirector\b|\bhead of\b/.test(value)) return "director";
  if (/\bmanager\b/.test(value)) return "manager";
  if (/\bstaff\b|\bprincipal\b/.test(value)) return "staff";
  if (/\blead\b/.test(value)) return "lead";
  if (/\bsenior\b|\bsr\.?\b/.test(value)) return "senior";
  if (/\bjunior\b|\bjr\.?\b|\bentry\b|new grad/.test(value)) return "junior";
  if (/\bintern\b|\bpasant/.test(value)) return "intern";
  return null;
}

export function safeIsoDate(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
