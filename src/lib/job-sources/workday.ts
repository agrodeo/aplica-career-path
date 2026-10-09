import {
  inferEmploymentType,
  inferRemoteType,
  inferSeniority,
  parseHumanPostedAt,
} from "@/lib/job-sources/normalization";
import type {
  JobSourceFetchResult,
  JobSourceProvider,
  NormalizedJob,
} from "@/lib/job-sources/types";

const PAGE_SIZE = 20;
const MAX_JOBS_PER_BOARD = 400;

type WorkdayListing = {
  title?: string | null;
  externalPath?: string | null;
  locationsText?: string | null;
  postedOn?: string | null;
  bulletFields?: string[] | null;
};

type WorkdaySearchPayload = {
  total?: number | null;
  jobPostings?: WorkdayListing[] | null;
};

type ParsedWorkdayBoard = {
  origin: string;
  tenant: string;
  site: string;
  locale: string | null;
};

function parseBoardUrl(identifier: string): ParsedWorkdayBoard {
  const url = new URL(identifier);
  const host = url.hostname.toLowerCase();
  const match = host.match(
    /^([a-z0-9-]+)\.(wd\d+)\.myworkdayjobs\.com$/i,
  );
  if (!match) throw new Error("URL de Workday inválida.");

  const tenant = match[1];
  const parts = url.pathname.split("/").filter(Boolean);
  const locale =
    parts[0] && /^[a-z]{2}(?:-[a-z]{2})?$/i.test(parts[0])
      ? parts.shift() ?? null
      : null;
  const site = parts[0];

  if (!site) {
    throw new Error(
      "No encontramos el careers site de Workday en la URL.",
    );
  }

  return {
    origin: url.origin,
    tenant,
    site,
    locale,
  };
}

function locationFromListing(job: WorkdayListing) {
  if (job.locationsText?.trim()) return job.locationsText.trim();
  const bullets = job.bulletFields ?? [];
  // Different Workday tenants expose bullet fields differently. Prefer the
  // second item (common requisition/location layout), then fall back safely.
  return bullets[1]?.trim() || bullets[0]?.trim() || null;
}

function applicationUrl(board: ParsedWorkdayBoard, externalPath: string) {
  const prefix = board.locale
    ? `/${board.locale}/${board.site}`
    : `/${board.site}`;
  return new URL(`${prefix}${externalPath}`, board.origin).toString();
}

function listingToJob(
  board: ParsedWorkdayBoard,
  listing: WorkdayListing,
): NormalizedJob | null {
  const title = listing.title?.trim();
  const externalPath = listing.externalPath?.trim();
  if (!title || !externalPath) return null;

  const location = locationFromListing(listing);
  // Workday's list feed does not consistently include the full JD. Keep this
  // truthful and let later enrichment fetch job detail instead of fabricating
  // requirements from title/location metadata.
  const description = "";

  return {
    externalId: externalPath,
    title: title.slice(0, 500),
    description,
    location,
    country: null,
    remoteType: inferRemoteType(title, location, description),
    employmentType: inferEmploymentType(title, description),
    seniority: inferSeniority(title),
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    applicationUrl: applicationUrl(board, externalPath),
    publishedAt: parseHumanPostedAt(listing.postedOn),
    rawData: {
      external_path: externalPath,
      posted_on: listing.postedOn ?? null,
      bullet_fields: listing.bulletFields ?? [],
      locations_text: listing.locationsText ?? null,
      description_enriched: false,
    },
  };
}

export const workdayProvider: JobSourceProvider = {
  type: "workday",
  sourceType: "workday_public_cxs",
  discoveryAdapter: "workday_public_cxs",
  submissionAdapter: null,
  async fetchJobs(identifier): Promise<JobSourceFetchResult> {
    const board = parseBoardUrl(identifier);
    const endpoint = `${board.origin}/wday/cxs/${encodeURIComponent(
      board.tenant,
    )}/${encodeURIComponent(board.site)}/jobs`;

    const headers = {
      accept: "application/json",
      "content-type": "application/json",
      // Workday career sites themselves call this public CXS endpoint from a
      // browser. We use a conventional browser UA; if a tenant returns a
      // challenge/403 we stop rather than trying to bypass it.
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
      referer: identifier,
    };

    const jobs: NormalizedJob[] = [];
    let reportedTotal: number | null = null;

    for (
      let offset = 0;
      offset < MAX_JOBS_PER_BOARD;
      offset += PAGE_SIZE
    ) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          appliedFacets: {},
          limit: PAGE_SIZE,
          offset,
          searchText: "",
        }),
        signal: AbortSignal.timeout(25_000),
      });

      if (!response.ok) {
        throw new Error(
          `Workday ${board.tenant}/${board.site} respondió ${response.status}.`,
        );
      }

      const payload = (await response.json()) as WorkdaySearchPayload;
      if (reportedTotal == null && typeof payload.total === "number") {
        reportedTotal = payload.total;
      }

      const postings = Array.isArray(payload.jobPostings)
        ? payload.jobPostings
        : [];
      if (!postings.length) break;

      for (const listing of postings) {
        const normalized = listingToJob(board, listing);
        if (normalized) jobs.push(normalized);
      }

      if (postings.length < PAGE_SIZE) break;
      if (reportedTotal != null && offset + PAGE_SIZE >= reportedTotal) break;
    }

    return {
      endpoint,
      jobs,
      reportedTotal,
    };
  },
};
