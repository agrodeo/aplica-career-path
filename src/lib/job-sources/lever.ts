import {
  finiteNumber,
  inferEmploymentType,
  inferRemoteType,
  inferSeniority,
  safeIsoDate,
  toPlainText,
} from "@/lib/job-sources/normalization";
import type { JobSourceProvider } from "@/lib/job-sources/types";

type LeverPosting = {
  id?: string;
  text?: string;
  description?: string;
  descriptionPlain?: string;
  hostedUrl?: string;
  applyUrl?: string;
  createdAt?: number;
  workplaceType?: string | null;
  categories?: {
    commitment?: string | null;
    department?: string | null;
    location?: string | null;
    team?: string | null;
  };
  salaryRange?: {
    currency?: string | null;
    interval?: string | null;
    min?: number | null;
    max?: number | null;
  } | null;
};

export const leverProvider: JobSourceProvider = {
  type: "lever",
  sourceType: "lever_postings_api",
  discoveryAdapter: "lever_postings_api",
  // The worker adapter exists but stays disabled until a verified E2E submission
  // is proven. Discovery and submission capability are intentionally separate.
  submissionAdapter: null,
  async fetchJobs(identifier) {
    const endpoint = `https://api.lever.co/v0/postings/${encodeURIComponent(identifier)}?mode=json`;
    const response = await fetch(endpoint, {
      headers: {
        accept: "application/json",
        "user-agent": "AplicaJobDiscovery/3.0 (+https://aplica.lat)",
      },
      signal: AbortSignal.timeout(25_000),
    });

    if (!response.ok) {
      throw new Error(`Lever ${identifier} respondió ${response.status}.`);
    }

    const payload = (await response.json()) as LeverPosting[];
    const sourceJobs = Array.isArray(payload) ? payload : [];

    return {
      endpoint,
      reportedTotal: sourceJobs.length,
      jobs: sourceJobs
        .filter((job) => job.id && job.text)
        .map((job) => {
          const title = String(job.text ?? "").trim().slice(0, 500);
          const description = toPlainText(
            job.descriptionPlain ?? job.description ?? "",
          );
          const location = job.categories?.location?.trim() || null;
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
              job.workplaceType,
            ),
            employmentType: inferEmploymentType(
              title,
              description,
              job.categories?.commitment,
            ),
            seniority: inferSeniority(title),
            salaryMin: finiteNumber(job.salaryRange?.min),
            salaryMax: finiteNumber(job.salaryRange?.max),
            salaryCurrency: job.salaryRange?.currency ?? null,
            applicationUrl: job.applyUrl ?? job.hostedUrl ?? null,
            publishedAt: safeIsoDate(job.createdAt),
            rawData: {
              workplace_type: job.workplaceType ?? null,
              categories: job.categories ?? null,
              hosted_url: job.hostedUrl ?? null,
              salary_interval: job.salaryRange?.interval ?? null,
            },
          };
        }),
    };
  },
};
