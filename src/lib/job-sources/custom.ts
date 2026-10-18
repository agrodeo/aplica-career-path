import {
  decodeEntities,
  inferEmploymentType,
  inferRemoteType,
  inferSeniority,
  toPlainText,
} from "@/lib/job-sources/normalization";
import type {
  JobSourceFetchResult,
  JobSourceProvider,
  NormalizedJob,
} from "@/lib/job-sources/types";

const DETAIL_CONCURRENCY = 8;
const MAX_CUSTOM_JOBS = 600;

type CustomBoardConfig = {
  company: string;
  listingUrl: string;
  detailUrl: (id: string) => string;
  idPattern: RegExp;
};

const CUSTOM_BOARDS: Record<string, CustomBoardConfig> = {
  rappi: {
    company: "Rappi",
    listingUrl: "https://careers.rappi.com/es/careers",
    detailUrl: (id) => `https://careers.rappi.com/es/careers/${id}`,
    idPattern:
      /href=["'][^"']*\/(?:es|en)\/careers\/([0-9a-f]{8}-[0-9a-f-]{27,})[^"']*["']/gi,
  },
  uala: {
    company: "Ualá",
    listingUrl: "https://www.ua.la/sumate",
    detailUrl: (id) => `https://www.ua.la/sumate/${id}`,
    idPattern:
      /href=["'][^"']*\/sumate\/([0-9a-f]{8}-[0-9a-f-]{27,})[^"']*["']/gi,
  },
};

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
    },
    signal: AbortSignal.timeout(25_000),
  });

  if (!response.ok) {
    throw new Error(`Custom careers ${url} respondió ${response.status}.`);
  }

  return response.text();
}

function extractIds(html: string, pattern: RegExp) {
  pattern.lastIndex = 0;
  const ids = new Set<string>();
  for (const match of html.matchAll(pattern)) {
    const id = match[1]?.trim();
    if (id) ids.add(id);
    if (ids.size >= MAX_CUSTOM_JOBS) break;
  }
  return [...ids];
}

function extractTag(html: string, tag: string) {
  const match = html.match(
    new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"),
  );
  return toPlainText(match?.[1] ?? "").trim();
}

function extractTitle(html: string) {
  const heading = extractTag(html, "h1");
  if (heading) return heading.slice(0, 500);

  const rawTitle = extractTag(html, "title")
    .replace(/\s*[|–—-]\s*(?:Rappi Careers|Ualá).*$/i, "")
    .trim();
  return rawTitle.slice(0, 500);
}

function extractExternalApplyUrl(html: string) {
  const match = html.match(
    /href=["'](https:\/\/[^"']*careers\.hibob\.com[^"']*)["']/i,
  );
  return match?.[1] ? decodeEntities(match[1]) : null;
}

const LOCATION_PATTERNS: Array<[RegExp, string, string]> = [
  [/Argentina\s*-\s*Buenos Aires/i, "Argentina - Buenos Aires", "Argentina"],
  [/Argentina\s*-\s*C[oó]rdoba/i, "Argentina - Córdoba", "Argentina"],
  [/Argentina\s*-\s*Mendoza/i, "Argentina - Mendoza", "Argentina"],
  [/Argentina\s*-\s*Rosario/i, "Argentina - Rosario", "Argentina"],
  [/Argentina\s*-\s*Pilar/i, "Argentina - Pilar", "Argentina"],
  [/Colombia\s*-\s*Bogot[aá]/i, "Colombia - Bogotá", "Colombia"],
  [/Colombia\s*-\s*Medell[ií]n/i, "Colombia - Medellín", "Colombia"],
  [/Colombia\s*-\s*Manizales/i, "Colombia - Manizales", "Colombia"],
  [/Colombia\s*-\s*Cali/i, "Colombia - Cali", "Colombia"],
  [/Colombia\s*-\s*Barranquilla/i, "Colombia - Barranquilla", "Colombia"],
  [/(?:M[eé]xico|Mexico)\s*-\s*Ciudad de M[eé]xico/i, "México - Ciudad de México", "Mexico"],
  [/(?:M[eé]xico|Mexico)\s*-\s*Monterrey/i, "México - Monterrey", "Mexico"],
  [/(?:M[eé]xico|Mexico)\s*-\s*Guadalajara/i, "México - Guadalajara", "Mexico"],
  [/Brazil\s*-\s*S[aã]o Paulo/i, "Brazil - São Paulo", "Brazil"],
  [/Brasil\s*-\s*S[aã]o Paulo/i, "Brazil - São Paulo", "Brazil"],
  [/Chile\s*-\s*Santiago/i, "Chile - Santiago", "Chile"],
  [/(?:Per[uú]|Peru)\s*-\s*Lima/i, "Peru - Lima", "Peru"],
];

function inferLocation(
  html: string,
  title: string,
): { location: string | null; country: string | null } {
  const plain = toPlainText(html);
  const titleIndex = title
    ? plain.toLocaleLowerCase().indexOf(title.toLocaleLowerCase())
    : -1;
  const nearby =
    titleIndex >= 0
      ? plain.slice(titleIndex, titleIndex + 1_200)
      : plain.slice(0, 2_000);

  for (const [pattern, location, country] of LOCATION_PATTERNS) {
    if (pattern.test(nearby)) return { location, country };
  }

  const countries: Array<[RegExp, string]> = [
    [/\bArgentina\b/i, "Argentina"],
    [/\bColombia\b/i, "Colombia"],
    [/\b(?:M[eé]xico|Mexico)\b/i, "Mexico"],
    [/\b(?:Brazil|Brasil)\b/i, "Brazil"],
    [/\bChile\b/i, "Chile"],
    [/\b(?:Per[uú]|Peru)\b/i, "Peru"],
    [/\bUruguay\b/i, "Uruguay"],
  ];

  for (const [pattern, country] of countries) {
    if (pattern.test(nearby)) return { location: country, country };
  }

  return { location: null, country: null };
}

async function mapConcurrent<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R | null>,
) {
  const results: R[] = [];
  let cursor = 0;

  async function runner() {
    while (true) {
      const index = cursor++;
      const item = items[index];
      if (item == null) return;

      try {
        const result = await worker(item);
        if (result != null) results.push(result);
      } catch (error) {
        console.warn(
          "Custom job detail fetch failed:",
          error instanceof Error ? error.message : String(error),
        );
      }
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, items.length || 1) },
      () => runner(),
    ),
  );

  return results;
}

async function fetchCustomBoard(
  identifier: string,
): Promise<JobSourceFetchResult> {
  const config = CUSTOM_BOARDS[identifier.toLowerCase()];
  if (!config) {
    throw new Error(`Custom careers board no soportado: ${identifier}.`);
  }

  const listingHtml = await fetchHtml(config.listingUrl);
  const ids = extractIds(listingHtml, config.idPattern);

  if (!ids.length) {
    throw new Error(
      `No encontramos vacantes públicas en ${config.company}; evitamos guardar un snapshot vacío.`,
    );
  }

  const jobs = await mapConcurrent(ids, DETAIL_CONCURRENCY, async (id) => {
    const detailUrl = config.detailUrl(id);
    const html = await fetchHtml(detailUrl);
    const title = extractTitle(html);
    if (!title) return null;

    const plain = toPlainText(html);
    const { location, country } = inferLocation(html, title);
    const externalApplyUrl = extractExternalApplyUrl(html);
    const applicationUrl = externalApplyUrl ?? detailUrl;

    const job: NormalizedJob = {
      externalId: id,
      title,
      description: plain.slice(0, 30_000),
      location,
      country,
      remoteType: inferRemoteType(title, location, plain),
      employmentType: inferEmploymentType(title, plain),
      seniority: inferSeniority(title),
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      applicationUrl,
      publishedAt: null,
      rawData: {
        custom_board: identifier.toLowerCase(),
        detail_url: detailUrl,
        external_apply_url: externalApplyUrl,
      },
    };

    return job;
  });

  return {
    endpoint: config.listingUrl,
    jobs,
    reportedTotal: ids.length,
  };
}

export const customProvider: JobSourceProvider = {
  type: "custom",
  sourceType: "custom_public_careers",
  discoveryAdapter: "custom_public_careers",
  submissionAdapter: null,
  fetchJobs: fetchCustomBoard,
};
