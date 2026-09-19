import { inferSeniority, normalizeEmploymentType, normalizeRemoteType, upsertSourceInventory } from "./shared";

type LeverPosting = {
  id: string;
  text: string;
  categories?: { location?: string; commitment?: string; team?: string; department?: string; level?: string; allLocations?: string[] };
  country?: string | null;
  descriptionPlain?: string;
  openingPlain?: string;
  additionalPlain?: string;
  hostedUrl?: string;
  applyUrl?: string;
  workplaceType?: string;
  createdAt?: number;
  salaryRange?: { min?: number; max?: number; currency?: string; interval?: string };
};

export async function syncLeverSource(input: { site: string; companyName: string; careersUrl?: string | null; eu?: boolean }) {
  const base = input.eu ? "https://api.eu.lever.co/v0/postings" : "https://api.lever.co/v0/postings";
  const endpoint = `${base}/${encodeURIComponent(input.site)}?mode=json&limit=500`;
  const response = await fetch(endpoint, {
    headers: { accept: "application/json", "user-agent": "AplicaJobDiscovery/2.0 (+https://aplica.lat)" },
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`Lever ${input.site} respondió ${response.status}.`);
  const postings = await response.json() as LeverPosting[];
  const jobs = (Array.isArray(postings) ? postings : []).filter((job) => job.id && job.text && (job.applyUrl || job.hostedUrl)).map((job) => {
    const description = [job.openingPlain, job.descriptionPlain, job.additionalPlain].filter(Boolean).join("\n\n").trim();
    return {
      externalJobId: job.id,
      title: job.text.trim(),
      description,
      location: job.categories?.location ?? job.categories?.allLocations?.join(" · ") ?? null,
      country: job.country ?? null,
      remoteType: normalizeRemoteType(job.workplaceType, `${job.categories?.location ?? ""} ${description.slice(0, 1000)}`),
      employmentType: normalizeEmploymentType(job.categories?.commitment),
      seniority: job.categories?.level?.toLowerCase() || inferSeniority(job.text),
      salaryMin: job.salaryRange?.min ?? null,
      salaryMax: job.salaryRange?.max ?? null,
      salaryCurrency: job.salaryRange?.currency ?? null,
      applicationUrl: job.applyUrl ?? job.hostedUrl!,
      publishedAt: job.createdAt ? new Date(job.createdAt).toISOString() : null,
      rawData: { hosted_url: job.hostedUrl ?? null, workplace_type: job.workplaceType ?? null, categories: job.categories ?? {}, salary_interval: job.salaryRange?.interval ?? null },
    };
  });
  return upsertSourceInventory({
    identifier: input.site,
    companyName: input.companyName,
    careersUrl: input.careersUrl ?? `https://jobs.lever.co/${input.site}`,
    definition: {
      atsType: "lever",
      sourceType: "lever_postings_api",
      adapterName: "lever_public_form",
      submissionEnabled: false,
      autoApplySupported: false,
      baseUrl: endpoint,
    },
    jobs,
  });
}
