import {
  inferSeniority,
  normalizeEmploymentType,
  normalizeRemoteType,
  toPlainText,
  upsertSourceInventory,
} from "./shared";

type WorkableJob = {
  title?: string;
  code?: string;
  shortcode?: string;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  location?: {
    location_str?: string | null;
    country?: string | null;
    country_code?: string | null;
    city?: string | null;
    workplace_type?: string | null;
    telecommuting?: boolean | null;
  } | null;
  telecommuting?: boolean | null;
  workplace_type?: string | null;
  employment_type?: string | null;
  experience?: string | null;
  published_on?: string | null;
  created_at?: string | null;
  url?: string | null;
  application_url?: string | null;
  shortlink?: string | null;
  description?: string | null;
  full_description?: string | null;
  salary?: {
    salary_from?: number | null;
    salary_to?: number | null;
    salary_currency?: string | null;
  } | null;
};

export async function syncWorkableSource(input: {
  account: string;
  companyName: string;
  careersUrl?: string | null;
}) {
  const endpoint =
    `https://www.workable.com/api/accounts/${encodeURIComponent(input.account)}?details=true`;
  const response = await fetch(endpoint, {
    headers: {
      accept: "application/json",
      "user-agent": "AplicaJobDiscovery/2.0 (+https://aplica.lat)",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) {
    throw new Error(`Workable ${input.account} respondió ${response.status}.`);
  }

  const payload = (await response.json()) as { jobs?: WorkableJob[] };
  const jobs = (payload.jobs ?? [])
    .filter((job) => job.title && (job.url || job.application_url || job.shortlink))
    .map((job) => {
      const location =
        job.location?.location_str ||
        [job.city || job.location?.city, job.state, job.country || job.location?.country]
          .filter(Boolean)
          .join(", ");
      const description = toPlainText(job.full_description || job.description || "");
      const id = job.shortcode || job.code || job.url || job.application_url!;

      return {
        externalJobId: String(id),
        title: job.title!.trim(),
        description,
        location: location || null,
        country: job.location?.country_code || job.country || job.location?.country || null,
        remoteType: normalizeRemoteType(
          job.workplace_type || job.location?.workplace_type || (job.telecommuting || job.location?.telecommuting ? "remote" : null),
          `${location} ${description.slice(0, 1000)}`,
        ),
        employmentType: normalizeEmploymentType(job.employment_type),
        seniority: job.experience?.toLowerCase() || inferSeniority(job.title!),
        salaryMin: job.salary?.salary_from ?? null,
        salaryMax: job.salary?.salary_to ?? null,
        salaryCurrency: job.salary?.salary_currency ?? null,
        applicationUrl: job.application_url || job.shortlink || job.url!,
        publishedAt: job.published_on || job.created_at || null,
        rawData: {
          shortcode: job.shortcode ?? null,
          code: job.code ?? null,
          public_url: job.url ?? null,
          experience: job.experience ?? null,
        },
      };
    });

  return upsertSourceInventory({
    identifier: input.account,
    companyName: input.companyName,
    careersUrl: input.careersUrl ?? `https://apply.workable.com/${input.account}/`,
    definition: {
      atsType: "workable",
      sourceType: "workable_public_jobs_api",
      adapterName: "workable_public",
      submissionEnabled: false,
      autoApplySupported: false,
      baseUrl: endpoint,
    },
    jobs,
  });
}
