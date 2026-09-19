export type AtsProvider = "greenhouse" | "lever" | "ashby" | "workday" | "smartrecruiters";

export type NormalizedJob = {
  externalId: string;
  title: string;
  description: string;
  location: string | null;
  country: string | null;
  remoteType: string | null;
  employmentType: string | null;
  seniority: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  applicationUrl: string | null;
  publishedAt: string | null;
  rawData: Record<string, unknown>;
};

export type JobSourceFetchResult = {
  endpoint: string;
  jobs: NormalizedJob[];
  reportedTotal: number | null;
};

export type JobSourceProvider = {
  type: AtsProvider;
  sourceType: string;
  discoveryAdapter: string;
  submissionAdapter: string | null;
  fetchJobs: (identifier: string) => Promise<JobSourceFetchResult>;
};
