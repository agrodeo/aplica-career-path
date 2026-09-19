import {
  inferEmploymentType,
  inferRemoteType,
  inferSeniority,
  safeIsoDate,
  toPlainText,
} from "@/lib/job-sources/normalization";
import type { JobSourceProvider } from "@/lib/job-sources/types";

type AshbyPosting = {
  id?: string;
  title?: string;
  location?: string | null;
  secondaryLocations?: Array<{ location?: string | null }> | null;
  department?: string | null;
  team?: string | null;
  employmentType?: string | null;
  workplaceType?: string | null;
  isRemote?: boolean | null;
  publishedAt?: string | null;
  jobUrl?: string | null;
  applyUrl?: string | null;
  descriptionHtml?: string | null;
  descriptionPlain?: string | null;
  compensation?: unknown;
};

export const ashbyProvider: JobSourceProvider = {
  type: "ashby",
  sourceType: "ashby_public_job_posting_api",
  discoveryAdapter: "ashby_public_job_posting_api",
  submissionAdapter: null,
  async fetchJobs(identifier) {
    const endpoint = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(identifier)}?includeCompensation=true`;
    const response = await fetch(endpoint, {
      headers: {
        accept: "application/json",
        "user-agent": "AplicaJobDiscovery/3.0 (+https://aplica.lat)",
      },
      signal: AbortSignal.timeout(25_000),
    });

    if (!response.ok) {
      throw new Error(`Ashby ${identifier} respondió ${response.status}.`);
    }

    const payload = (await response.json()) as { jobs?: AshbyPosting[] };
    const sourceJobs = Array.isArray(payload.jobs) ? payload.jobs : [];

    return {
      endpoint,
      reportedTotal: sourceJobs.length,
      jobs: sourceJobs
        .filter((job) => job.id && job.title)
        .map((job) => {
          const title = String(job.title ?? "").trim().slice(0, 500);
          const description = toPlainText(
            job.descriptionPlain ?? job.descriptionHtml ?? "",
          );
          const location = job.location?.trim() || null;
          const explicitRemote = job.isRemote
            ? "remote"
            : job.workplaceType ?? null;
          return {
            externalId: String(job.id),
            title,
            description,
            location,
            country: null,
            remoteType: inferRemoteType(
              title,
              location,
              description,
              explicitRemote,
            ),
            employmentType: inferEmploymentType(
              title,
              description,
              job.employmentType,
            ),
            seniority: inferSeniority(title),
            salaryMin: null,
            salaryMax: null,
            salaryCurrency: null,
            applicationUrl: job.applyUrl ?? job.jobUrl ?? null,
            publishedAt: safeIsoDate(job.publishedAt),
            rawData: {
              secondary_locations: job.secondaryLocations ?? [],
              department: job.department ?? null,
              team: job.team ?? null,
              workplace_type: job.workplaceType ?? null,
              is_remote: job.isRemote ?? null,
              job_url: job.jobUrl ?? null,
              compensation: job.compensation ?? null,
            },
          };
        }),
    };
  },
};
