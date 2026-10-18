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


export function parseHumanPostedAt(
  value: string | null | undefined,
  now = new Date(),
) {
  if (!value?.trim()) return null;
  const text = value.trim().toLowerCase();

  if (/^(posted\s+)?today$/.test(text)) {
    return now.toISOString();
  }
  if (/^(posted\s+)?yesterday$/.test(text)) {
    return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  }

  const days = text.match(/(?:posted\s+)?(\d+)\+?\s+days?\s+ago/);
  if (days) {
    const count = Number(days[1]);
    if (Number.isFinite(count)) {
      return new Date(now.getTime() - count * 24 * 60 * 60 * 1000).toISOString();
    }
  }

  return safeIsoDate(value);
}


const COUNTRY_ALIAS_RULES: Array<[RegExp, string]> = [
  [/\bargentina\b|\bbuenos aires\b/, "ar"],
  [/\bbrazil\b|\bbrasil\b|\bsao paulo\b|\brio de janeiro\b/, "br"],
  [/\bmexico\b|\bmexico city\b|\bciudad de mexico\b/, "mx"],
  [/\bcolombia\b|\bbogota\b|\bmedellin\b/, "co"],
  [/\bchile\b/, "cl"],
  [/\bperu\b|\blima\b/, "pe"],
  [/\buruguay\b|\bmontevideo\b/, "uy"],
  [/\becuador\b|\bquito\b|\bguayaquil\b/, "ec"],
  [/\bparaguay\b|\basuncion\b/, "py"],
  [/\bbolivia\b/, "bo"],
  [/\bcosta rica\b/, "cr"],
  [/\bpanama\b/, "pa"],
  [/\bguatemala\b/, "gt"],
  [/\bhonduras\b/, "hn"],
  [/\bel salvador\b/, "sv"],
  [/\bnicaragua\b/, "ni"],
  [/\bdominican republic\b|\brepublica dominicana\b/, "do"],
  [/\bpuerto rico\b/, "pr"],
  [/\bunited states\b|\busa\b|\bu\.s\.a\b/, "us"],
  [/\bunited kingdom\b|\bgreat britain\b|\bengland\b|\bscotland\b|\bwales\b/, "gb"],
  [/\bfrance\b/, "fr"],
  [/\bgermany\b|\bdeutschland\b/, "de"],
  [/\bindia\b/, "in"],
  [/\bnetherlands\b/, "nl"],
  [/\bspain\b|\bespana\b/, "es"],
  [/\bcanada\b/, "ca"],
  [/\bchina\b/, "cn"],
  [/\bmalaysia\b/, "my"],
  [/\bbelgium\b/, "be"],
  [/\bpoland\b/, "pl"],
  [/\bjapan\b/, "jp"],
  [/\bromania\b/, "ro"],
  [/\bportugal\b/, "pt"],
  [/\bsweden\b/, "se"],
  [/\bitaly\b|\bitalia\b/, "it"],
  [/\bphilippines\b/, "ph"],
  [/\bhungary\b/, "hu"],
  [/\baustralia\b/, "au"],
  [/\bnorway\b/, "no"],
  [/\bvietnam\b|\bviet nam\b/, "vn"],
  [/\bsingapore\b/, "sg"],
  [/\bswitzerland\b/, "ch"],
  [/\bireland\b/, "ie"],
  [/\bdenmark\b/, "dk"],
  [/\begypt\b/, "eg"],
  [/\baustria\b/, "at"],
  [/\bbulgaria\b/, "bg"],
  [/\bthailand\b/, "th"],
  [/\bsouth korea\b|\brepublic of korea\b/, "kr"],
  [/\bczech republic\b|\bczechia\b/, "cz"],
  [/\bukraine\b/, "ua"],
  [/\btaiwan\b/, "tw"],
  [/\bindonesia\b/, "id"],
  [/\bmorocco\b/, "ma"],
  [/\btunisia\b/, "tn"],
  [/\bfinland\b/, "fi"],
  [/\bsaudi arabia\b/, "sa"],
  [/\bturkey\b|\bturkiye\b/, "tr"],
  [/\bgreece\b/, "gr"],
  [/\bestonia\b/, "ee"],
  [/\bunited arab emirates\b|\buae\b/, "ae"],
];

function normalizedGeoText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, " ")
    .replace(/[^a-z0-9.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalize a country to an ISO-3166 alpha-2-ish lowercase code.
 * The first argument is the ATS country field and may already be a 2-letter
 * code. Additional hints are free-form location strings.
 */
export function normalizeCountryCode(
  country: string | null | undefined,
  ...locationHints: Array<string | null | undefined>
) {
  const direct = country?.trim().toLowerCase() ?? "";
  if (/^[a-z]{2}$/.test(direct)) return direct;

  const combined = [country, ...locationHints]
    .filter((value): value is string => Boolean(value?.trim()))
    .map(normalizedGeoText)
    .join(" ");

  if (!combined) return null;
  for (const [pattern, code] of COUNTRY_ALIAS_RULES) {
    if (pattern.test(combined)) return code;
  }
  return null;
}
