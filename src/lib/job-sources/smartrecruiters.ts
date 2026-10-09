import {
  inferEmploymentType,
  inferRemoteType,
  inferSeniority,
  safeIsoDate,
  toPlainText,
} from "@/lib/job-sources/normalization";
import type {
  JobSourceFetchResult,
  JobSourceProvider,
  NormalizedJob,
} from "@/lib/job-sources/types";

const PAGE_SIZE = 100;
const MAX_JOBS_PER_BOARD = 400;
const DETAIL_CONCURRENCY = 8;

type SmartRecruitersLocation = {
  country?: string | null;
  region?: string | null;
  city?: string | null;
  remote?: boolean | null;
};

type SmartRecruitersPosting = {
  id?: string | null;
  uuid?: string | null;
  name?: string | null;
  releasedDate?: string | null;
  location?: SmartRecruitersLocation | null;
  typeOfEmployment?: { label?: string | null } | null;
  experienceLevel?: { label?: string | null } | null;
  department?: { label?: string | null } | null;
  function?: { label?: string | null } | null;
  company?: { identifier?: string | null; name?: string | null } | null;
  ref?: string | null;
};

type SmartRecruitersPostingDetail = SmartRecruitersPosting & {
  applyUrl?: string | null;
  active?: boolean | null;
  jobAd?: {
    sections?: Record<
      string,
      { title?: string | null; text?: string | null } | null
    > | null;
  } | null;
};

type SmartRecruitersList = {
  totalFound?: number | null;
  content?: SmartRecruitersPosting[] | null;
};

function locationText(location?: SmartRecruitersLocation | null) {
  const values = [
    location?.city?.trim(),
    location?.region?.trim(),
    location?.country?.trim(),
  ].filter((value): value is string => Boolean(value));
  return values.length ? values.join(", ") : null;
}

function detailDescription(detail: SmartRecruitersPostingDetail | null) {
  const sections = detail?.jobAd?.sections ?? {};
  const orderedKeys = [
    "companyDescription",
    "jobDescription",
    "qualifications",
    "additionalInformation",
  ];
  const values = orderedKeys
    .map((key) => sections[key]?.text)
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => toPlainText(value));
  return values.join("\n\n").trim();
}

async function mapConcurrent<T, R>(
  values: T[],
  limit: number,
  fn: (value: T) => Promise<R>,
) {
  const results = new Array<R>(values.length);
  let cursor = 0;

  async function runner() {
    while (true) {
      const index = cursor++;
      if (index >= values.length) return;
      results[index] = await fn(values[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, values.length || 1) }, () => runner()),
  );
  return results;
}

async function fetchDetail(
  companyIdentifier: string,
  posting: SmartRecruitersPosting,
) {
  const postingId = posting.id ?? posting.uuid;
  if (!postingId) return null;

  const url = `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(
    companyIdentifier,
  )}/postings/${encodeURIComponent(postingId)}`;

  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "accept-language": "en",
        "user-agent": "AplicaJobDiscovery/3.0 (+https://aplica.lat)",
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return null;
    return (await response.json()) as SmartRecruitersPostingDetail;
  } catch {
    return null;
  }
}

function normalizePosting(
  companyIdentifier: string,
  posting: SmartRecruitersPosting,
  detail: SmartRecruitersPostingDetail | null,
): NormalizedJob | null {
  const source = detail ?? posting;
  const externalId = source.uuid ?? source.id;
  const title = source.name?.trim();
  if (!externalId || !title) return null;

  const description = detailDescription(detail);
  const location = locationText(source.location);
  const remoteType = source.location?.remote
    ? "remote"
    : inferRemoteType(title, location, description);
  const employmentLabel = source.typeOfEmployment?.label ?? null;
  const seniorityLabel = source.experienceLevel?.label ?? null;

  return {
    externalId,
    title: title.slice(0, 500),
    description,
    location,
    country: source.location?.country ?? null,
    remoteType,
    employmentType: inferEmploymentType(
      title,
      description,
      employmentLabel,
    ),
    seniority:
      seniorityLabel?.trim() ||
      inferSeniority(title),
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    applicationUrl:
      detail?.applyUrl ??
      `https://jobs.smartrecruiters.com/${encodeURIComponent(
        companyIdentifier,
      )}/${encodeURIComponent(source.id ?? externalId)}`,
    publishedAt: safeIsoDate(source.releasedDate),
    rawData: {
      posting_id: source.id ?? null,
      posting_uuid: source.uuid ?? null,
      company: source.company ?? null,
      department: source.department ?? null,
      function: source.function ?? null,
      type_of_employment: source.typeOfEmployment ?? null,
      experience_level: source.experienceLevel ?? null,
      ref: source.ref ?? null,
      detail_loaded: Boolean(detail),
    },
  };
}

export const smartRecruitersProvider: JobSourceProvider = {
  type: "smartrecruiters",
  sourceType: "smartrecruiters_public_posting_api",
  discoveryAdapter: "smartrecruiters_public_posting_api",
  submissionAdapter: null,
  async fetchJobs(identifier): Promise<JobSourceFetchResult> {
    const companyIdentifier = identifier.trim();
    const endpoint = `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(
      companyIdentifier,
    )}/postings`;

    const listings: SmartRecruitersPosting[] = [];
    let reportedTotal: number | null = null;

    for (
      let offset = 0;
      offset < MAX_JOBS_PER_BOARD;
      offset += PAGE_SIZE
    ) {
      const url = new URL(endpoint);
      url.searchParams.set("limit", String(PAGE_SIZE));
      url.searchParams.set("offset", String(offset));
      url.searchParams.set("destination", "PUBLIC");

      const response = await fetch(url, {
        headers: {
          accept: "application/json",
          "accept-language": "en",
          "user-agent": "AplicaJobDiscovery/3.0 (+https://aplica.lat)",
        },
        signal: AbortSignal.timeout(25_000),
      });

      if (!response.ok) {
        throw new Error(
          `SmartRecruiters ${companyIdentifier} respondió ${response.status}.`,
        );
      }

      const payload = (await response.json()) as SmartRecruitersList;
      if (reportedTotal == null && typeof payload.totalFound === "number") {
        reportedTotal = payload.totalFound;
      }

      const page = Array.isArray(payload.content) ? payload.content : [];
      if (!page.length) break;
      listings.push(...page);

      if (page.length < PAGE_SIZE) break;
      if (reportedTotal != null && offset + PAGE_SIZE >= reportedTotal) break;
    }

    const capped = listings.slice(0, MAX_JOBS_PER_BOARD);
    const details = await mapConcurrent(
      capped,
      DETAIL_CONCURRENCY,
      (posting) => fetchDetail(companyIdentifier, posting),
    );

    const jobs = capped
      .map((posting, index) =>
        normalizePosting(companyIdentifier, posting, details[index]),
      )
      .filter((job): job is NormalizedJob => Boolean(job));

    return {
      endpoint,
      jobs,
      reportedTotal,
    };
  },
};
