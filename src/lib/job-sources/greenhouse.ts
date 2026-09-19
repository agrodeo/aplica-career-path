import {
  inferEmploymentType,
  inferRemoteType,
  inferSeniority,
  safeIsoDate,
  toPlainText,
} from "@/lib/job-sources/normalization";
import type { JobSourceProvider } from "@/lib/job-sources/types";

type GreenhouseJob = {
  id: number;
  internal_job_id?: number | null;
  title: string;
  updated_at?: string;
  location?: { name?: string | null } | null;
  absolute_url?: string | null;
  content?: string | null;
  language?: string | null;
  metadata?: unknown;
  departments?: Array<{ id?: number; name?: string; parent_id?: number | null }>;
  offices?: Array<{ id?: number; name?: string; location?: string | null }>;
};

function canonicalApplicationUrl(boardToken: string, jobId: number) {
  return `https://job-boards.greenhouse.io/${encodeURIComponent(boardToken)}/jobs/${jobId}`;
}

export const greenhouseProvider: JobSourceProvider = {
  type: "greenhouse",
  sourceType: "greenhouse_job_board",
  discoveryAdapter: "greenhouse_job_board",
  submissionAdapter: "greenhouse_public_form",
  async fetchJobs(identifier) {
    const endpoint = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(identifier)}/jobs?content=true`;
    const response = await fetch(endpoint, {
      headers: {
        accept: "application/json",
        "user-agent": "AplicaJobDiscovery/3.0 (+https://aplica.lat)",
      },
      signal: AbortSignal.timeout(25_000),
    });

    if (!response.ok) {
      throw new Error(`Greenhouse ${identifier} respondió ${response.status}.`);
    }

    const payload = (await response.json()) as {
      jobs?: GreenhouseJob[];
      meta?: { total?: number };
    };
    const sourceJobs = Array.isArray(payload.jobs) ? payload.jobs : [];

    return {
      endpoint,
      reportedTotal: payload.meta?.total ?? sourceJobs.length,
      jobs: sourceJobs.map((job) => {
        const description = toPlainText(job.content);
        const location = job.location?.name?.trim() || null;
        return {
          externalId: String(job.id),
          title: job.title.trim().slice(0, 500),
          description,
          location,
          country:
            job.offices?.find((office) => office.location)?.location ?? null,
          remoteType: inferRemoteType(job.title, location, description),
          employmentType: inferEmploymentType(job.title, description),
          seniority: inferSeniority(job.title),
          salaryMin: null,
          salaryMax: null,
          salaryCurrency: null,
          applicationUrl: canonicalApplicationUrl(identifier, job.id),
          publishedAt: safeIsoDate(job.updated_at),
          rawData: {
            board_token: identifier,
            internal_job_id: job.internal_job_id ?? null,
            absolute_url: job.absolute_url ?? null,
            updated_at: job.updated_at ?? null,
            language: job.language ?? null,
            metadata: job.metadata ?? null,
            departments: job.departments ?? [],
            offices: job.offices ?? [],
          },
        };
      }),
    };
  },
};
