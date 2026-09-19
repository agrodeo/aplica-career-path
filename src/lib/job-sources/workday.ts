import {
  inferSeniority,
  normalizeEmploymentType,
  normalizeRemoteType,
  toPlainText,
  upsertSourceInventory,
} from "./shared";

type WorkdayPosting = {
  title?: string;
  externalPath?: string;
  locationsText?: string;
  postedOn?: string;
  bulletFields?: string[];
};

type WorkdayList = {
  total?: number;
  jobPostings?: WorkdayPosting[];
};

type WorkdayDetail = {
  jobPostingInfo?: {
    title?: string;
    jobDescription?: string;
    location?: string;
    additionalLocations?: string[];
    jobReqId?: string;
    jobPostingId?: string;
    startDate?: string;
    timeType?: string;
    remoteType?: string;
  };
};

function canonicalDate(value: string | null | undefined) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

export async function syncWorkdaySource(input: {
  host: string;
  tenant: string;
  site: string;
  companyName: string;
  careersUrl?: string | null;
}) {
  if (!/^[a-z0-9.-]+\.myworkdayjobs\.com$/i.test(input.host) && !/^[a-z0-9.-]+\.myworkdaysite\.com$/i.test(input.host)) {
    throw new Error("Host de Workday inválido.");
  }

  const origin = `https://${input.host}`;
  const cxsBase =
    `${origin}/wday/cxs/${encodeURIComponent(input.tenant)}/${encodeURIComponent(input.site)}`;
  const careerUrl = new URL(
    input.careersUrl ?? `${origin}/${encodeURIComponent(input.site)}`,
  );
  const careerSegments = careerUrl.pathname.split("/").filter(Boolean);
  const localePrefix =
    careerSegments[0] && /^[a-z]{2}(?:-[A-Z]{2})?$/.test(careerSegments[0])
      ? `/${careerSegments[0]}/${encodeURIComponent(input.site)}`
      : `/${encodeURIComponent(input.site)}`;
  const postings: WorkdayPosting[] = [];

  for (let offset = 0; offset < 2000; offset += 20) {
    const response = await fetch(`${cxsBase}/jobs`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "user-agent": "Mozilla/5.0 AplicaJobDiscovery/2.0",
        referer: input.careersUrl ?? `${origin}/${input.site}`,
      },
      body: JSON.stringify({
        appliedFacets: {},
        limit: 20,
        offset,
        searchText: "",
      }),
      signal: AbortSignal.timeout(25_000),
    });

    if (!response.ok) {
      throw new Error(`Workday ${input.tenant}/${input.site} respondió ${response.status}.`);
    }

    const payload = (await response.json()) as WorkdayList;
    const page = payload.jobPostings ?? [];
    postings.push(...page);
    if (!page.length || postings.length >= Number(payload.total ?? Infinity)) break;
  }

  const detailed: Array<{ posting: WorkdayPosting; detail: WorkdayDetail | null }> = [];
  for (let i = 0; i < postings.length; i += 6) {
    const chunk = postings.slice(i, i + 6);
    const resolved = await Promise.all(
      chunk.map(async (posting) => {
        if (!posting.externalPath) return { posting, detail: null };
        try {
          const response = await fetch(`${cxsBase}${posting.externalPath}`, {
            headers: {
              accept: "application/json",
              "user-agent": "Mozilla/5.0 AplicaJobDiscovery/2.0",
              referer: input.careersUrl ?? `${origin}/${input.site}`,
            },
            signal: AbortSignal.timeout(20_000),
          });
          if (!response.ok) return { posting, detail: null };
          return { posting, detail: (await response.json()) as WorkdayDetail };
        } catch {
          return { posting, detail: null };
        }
      }),
    );
    detailed.push(...resolved);
  }

  const jobs = detailed
    .filter(({ posting }) => posting.title && posting.externalPath)
    .map(({ posting, detail }) => {
      const info = detail?.jobPostingInfo;
      const title = info?.title || posting.title!;
      const description = toPlainText(info?.jobDescription || "");
      const location =
        info?.location ||
        [posting.locationsText, ...(info?.additionalLocations ?? [])]
          .filter(Boolean)
          .join(" · ") ||
        null;
      const externalJobId =
        info?.jobPostingId ||
        info?.jobReqId ||
        posting.externalPath!;

      return {
        externalJobId: String(externalJobId),
        title: title.trim(),
        description,
        location,
        country: null,
        remoteType: normalizeRemoteType(
          info?.remoteType,
          `${location ?? ""} ${description.slice(0, 1000)}`,
        ),
        employmentType: normalizeEmploymentType(info?.timeType),
        seniority: inferSeniority(title),
        salaryMin: null,
        salaryMax: null,
        salaryCurrency: null,
        applicationUrl: posting.externalPath!.startsWith(localePrefix)
          ? `${origin}${posting.externalPath}`
          : `${origin}${localePrefix}${posting.externalPath}`,
        publishedAt: canonicalDate(info?.startDate) || canonicalDate(posting.postedOn),
        rawData: {
          external_path: posting.externalPath,
          posted_on: posting.postedOn ?? null,
          bullet_fields: posting.bulletFields ?? [],
          job_req_id: info?.jobReqId ?? null,
          job_posting_id: info?.jobPostingId ?? null,
        },
      };
    });

  return upsertSourceInventory({
    identifier: `${input.host}|${input.site}`,
    companyName: input.companyName,
    careersUrl: input.careersUrl ?? `${origin}/${input.site}`,
    definition: {
      atsType: "workday",
      sourceType: "workday_cxs",
      adapterName: "workday_public",
      submissionEnabled: false,
      autoApplySupported: false,
      baseUrl: `${cxsBase}/jobs`,
    },
    jobs,
  });
}
