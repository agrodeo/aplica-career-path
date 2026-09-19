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

type WorkableJob = {
  title?: string | null;
  shortcode?: string | null;
  url?: string | null;
  published_on?: string | null;
  created_at?: string | null;
  country?: string | null;
  city?: string | null;
  state?: string | null;
  telecommuting?: boolean | null;
  description?: string | null;
  department?: string | null;
  employment_type?: string | null;
};

type WorkableWidget = {
  name?: string | null;
  description?: string | null;
  jobs?: WorkableJob[] | null;
};

function locationText(job: WorkableJob) {
  const values = [job.city, job.state, job.country]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  if (job.telecommuting) values.push("Remote");
  return values.length ? values.join(", ") : null;
}

export const workableProvider: JobSourceProvider = {
  type: "workable",
  sourceType: "workable_public_widget",
  discoveryAdapter: "workable_public_widget",
  submissionAdapter: null,
  async fetchJobs(identifier): Promise<JobSourceFetchResult> {
    const slug = identifier.trim();
    const endpoint = `https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(
      slug,
    )}?details=true`;

    const response = await fetch(endpoint, {
      headers: {
        accept: "application/json",
        "user-agent": "AplicaJobDiscovery/3.0 (+https://aplica.lat)",
      },
      signal: AbortSignal.timeout(25_000),
    });

    if (!response.ok) {
      throw new Error(`Workable ${slug} respondió ${response.status}.`);
    }

    const payload = (await response.json()) as WorkableWidget;
    const sourceJobs = Array.isArray(payload.jobs) ? payload.jobs : [];

    const jobs = sourceJobs
      .map((job): NormalizedJob | null => {
        const title = job.title?.trim();
        const externalId = job.shortcode?.trim();
        if (!title || !externalId) return null;

        const description = toPlainText(job.description);
        const location = locationText(job);
        const remoteType = job.telecommuting
          ? "remote"
          : inferRemoteType(title, location, description);

        return {
          externalId,
          title: title.slice(0, 500),
          description,
          location,
          country: job.country?.trim() || null,
          remoteType,
          employmentType: inferEmploymentType(
            title,
            description,
            job.employment_type,
          ),
          seniority: inferSeniority(title),
          salaryMin: null,
          salaryMax: null,
          salaryCurrency: null,
          applicationUrl:
            job.url?.trim() ||
            `https://apply.workable.com/${encodeURIComponent(
              slug,
            )}/j/${encodeURIComponent(externalId)}/`,
          publishedAt: safeIsoDate(job.published_on ?? job.created_at),
          rawData: {
            account_name: payload.name ?? null,
            department: job.department ?? null,
            telecommuting: job.telecommuting ?? null,
            created_at: job.created_at ?? null,
            published_on: job.published_on ?? null,
          },
        };
      })
      .filter((job): job is NormalizedJob => Boolean(job));

    return {
      endpoint,
      jobs,
      reportedTotal: jobs.length,
    };
  },
};
