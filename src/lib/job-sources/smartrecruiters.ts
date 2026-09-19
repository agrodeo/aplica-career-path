import {
  inferSeniority,
  normalizeEmploymentType,
  normalizeRemoteType,
  toPlainText,
  upsertSourceInventory,
} from "./shared";

type SmartPostingSummary = {
  id: string;
  uuid?: string;
  name?: string;
  title?: string;
  releasedDate?: string | null;
  applyUrl?: string | null;
  postingUrl?: string | null;
  ref?: string | null;
  location?: {
    city?: string | null;
    region?: string | null;
    country?: string | null;
    countryCode?: string | null;
    remote?: boolean | null;
  } | null;
  experienceLevel?: { label?: string | null } | null;
  typeOfEmployment?: { label?: string | null } | null;
};

type SmartPostingDetail = SmartPostingSummary & {
  active?: boolean;
  jobAd?: {
    sections?: {
      jobDescription?: { text?: string | null } | null;
      qualifications?: { text?: string | null } | null;
      additionalInformation?: { text?: string | null } | null;
    } | null;
  } | null;
};

async function fetchJson(url: string) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "AplicaJobDiscovery/2.0 (+https://aplica.lat)",
    },
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`SmartRecruiters respondió ${response.status}.`);
  return response.json();
}

export async function syncSmartRecruitersSource(input: {
  companyIdentifier: string;
  companyName: string;
  careersUrl?: string | null;
}) {
  const summaries: SmartPostingSummary[] = [];
  const limit = 100;

  for (let offset = 0; offset < 1000; offset += limit) {
    const endpoint =
      `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(input.companyIdentifier)}/postings?limit=${limit}&offset=${offset}`;
    const payload = (await fetchJson(endpoint)) as {
      totalFound?: number;
      content?: SmartPostingSummary[];
    };
    const page = Array.isArray(payload.content) ? payload.content : [];
    summaries.push(...page);
    if (page.length < limit || summaries.length >= Number(payload.totalFound ?? Infinity)) break;
  }

  const details: SmartPostingDetail[] = [];
  for (let i = 0; i < summaries.length; i += 8) {
    const chunk = summaries.slice(i, i + 8);
    const resolved = await Promise.all(
      chunk.map(async (posting) => {
        try {
          return (await fetchJson(
            `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(input.companyIdentifier)}/postings/${encodeURIComponent(posting.id)}`,
          )) as SmartPostingDetail;
        } catch {
          return posting as SmartPostingDetail;
        }
      }),
    );
    details.push(...resolved);
  }

  const jobs = details
    .filter((job) => job.active !== false && job.id && (job.name || job.title))
    .map((job) => {
      const sections = job.jobAd?.sections;
      const description = [
        sections?.jobDescription?.text,
        sections?.qualifications?.text,
        sections?.additionalInformation?.text,
      ]
        .filter(Boolean)
        .map((value) => toPlainText(value))
        .join("\n\n")
        .trim();
      const location = [
        job.location?.city,
        job.location?.region,
        job.location?.country,
      ]
        .filter(Boolean)
        .join(", ");

      return {
        externalJobId: job.uuid || job.id,
        title: (job.name || job.title || "").trim(),
        description,
        location: location || null,
        country: job.location?.countryCode ?? job.location?.country ?? null,
        remoteType: normalizeRemoteType(
          job.location?.remote ? "remote" : null,
          `${location} ${description.slice(0, 1000)}`,
        ),
        employmentType: normalizeEmploymentType(job.typeOfEmployment?.label),
        seniority: job.experienceLevel?.label?.toLowerCase() || inferSeniority(job.name || job.title || ""),
        salaryMin: null,
        salaryMax: null,
        salaryCurrency: null,
        applicationUrl: job.applyUrl || job.postingUrl || job.ref || `https://jobs.smartrecruiters.com/${input.companyIdentifier}`,
        publishedAt: job.releasedDate ?? null,
        rawData: {
          posting_id: job.id,
          posting_uuid: job.uuid ?? null,
          posting_url: job.postingUrl ?? null,
          experience_level: job.experienceLevel?.label ?? null,
          employment_type_label: job.typeOfEmployment?.label ?? null,
        },
      };
    })
    .filter((job) => Boolean(job.applicationUrl));

  return upsertSourceInventory({
    identifier: input.companyIdentifier,
    companyName: input.companyName,
    careersUrl:
      input.careersUrl ??
      `https://careers.smartrecruiters.com/${input.companyIdentifier}`,
    definition: {
      atsType: "smartrecruiters",
      sourceType: "smartrecruiters_posting_api",
      adapterName: "smartrecruiters_public",
      submissionEnabled: false,
      autoApplySupported: false,
      baseUrl: `https://api.smartrecruiters.com/v1/companies/${input.companyIdentifier}/postings`,
    },
    jobs,
  });
}
