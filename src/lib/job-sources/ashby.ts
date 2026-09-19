import { inferSeniority, normalizeEmploymentType, normalizeRemoteType, upsertSourceInventory } from "./shared";

type AshbyJob = {
  title: string;
  location?: string | null;
  secondaryLocations?: Array<{ location?: string | null; address?: { addressCountry?: string | null } }>;
  department?: string | null;
  team?: string | null;
  isListed?: boolean;
  isRemote?: boolean;
  workplaceType?: string | null;
  descriptionPlain?: string | null;
  publishedAt?: string | null;
  employmentType?: string | null;
  address?: { postalAddress?: { addressCountry?: string | null } };
  jobUrl?: string | null;
  applyUrl?: string | null;
  compensation?: {
    scrapeableCompensationSalarySummary?: string | null;
    compensationTierSummary?: string | null;
  } | null;
};

function jobId(job: AshbyJob) {
  const url = job.jobUrl || job.applyUrl || "";
  const match = url.match(/\/([0-9a-f-]{20,})(?:\/apply)?(?:\?|$)/i);
  return match?.[1] ?? url;
}

export async function syncAshbySource(input: { boardName: string; companyName: string; careersUrl?: string | null }) {
  const endpoint = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(input.boardName)}?includeCompensation=true`;
  const response = await fetch(endpoint, {
    headers: { accept: "application/json", "user-agent": "AplicaJobDiscovery/2.0 (+https://aplica.lat)" },
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`Ashby ${input.boardName} respondió ${response.status}.`);
  const payload = await response.json() as { jobs?: AshbyJob[] };
  const jobs = (payload.jobs ?? []).filter((job) => job.isListed !== false && job.title && (job.applyUrl || job.jobUrl)).map((job) => {
    const description = job.descriptionPlain?.trim() ?? "";
    return {
      externalJobId: jobId(job),
      title: job.title.trim(),
      description,
      location: job.location ?? job.secondaryLocations?.map((location) => location.location).filter(Boolean).join(" · ") ?? null,
      country: job.address?.postalAddress?.addressCountry ?? job.secondaryLocations?.find((location) => location.address?.addressCountry)?.address?.addressCountry ?? null,
      remoteType: normalizeRemoteType(job.workplaceType, job.isRemote ? "remote" : `${job.location ?? ""} ${description.slice(0, 1000)}`),
      employmentType: normalizeEmploymentType(job.employmentType),
      seniority: inferSeniority(job.title),
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      applicationUrl: job.applyUrl ?? job.jobUrl!,
      publishedAt: job.publishedAt ?? null,
      rawData: {
        job_url: job.jobUrl ?? null,
        workplace_type: job.workplaceType ?? null,
        is_remote: job.isRemote ?? null,
        department: job.department ?? null,
        team: job.team ?? null,
        compensation_summary: job.compensation?.scrapeableCompensationSalarySummary ?? job.compensation?.compensationTierSummary ?? null,
      },
    };
  });
  return upsertSourceInventory({
    identifier: input.boardName,
    companyName: input.companyName,
    careersUrl: input.careersUrl ?? `https://jobs.ashbyhq.com/${input.boardName}`,
    definition: {
      atsType: "ashby",
      sourceType: "ashby_posting_api",
      adapterName: "ashby_public_form",
      submissionEnabled: false,
      autoApplySupported: false,
      baseUrl: endpoint,
    },
    jobs,
  });
}
