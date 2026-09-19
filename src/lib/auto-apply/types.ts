// Core domain types for the Aplica Auto Apply architecture.
// These types are shared by the frontend, server functions and the external worker.

export interface MasterProfileIdentity {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  whatsapp: string;
  city: string;
  country: string;
  currentTitle: string;
  professionalSummary: string;
}

export interface MasterExperience {
  id: string;
  company: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  description: string;
  achievements: string[];
  verifiedByUser: boolean;
}

export interface MasterEducation {
  id: string;
  institution: string;
  degree: string;
  field: string;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  verifiedByUser: boolean;
}

export interface MasterSkill {
  id: string;
  name: string;
  yearsExperience: number | null;
  verifiedByUser: boolean;
}

export interface MasterLanguage {
  language: string;
  level: string;
}

export interface MasterPreferences {
  targetRoles: string[];
  targetLocations: string[];
  remoteAllowed: boolean;
  hybridAllowed: boolean;
  onsiteAllowed: boolean;
  employmentTypes: string[];
  minimumSalary: number | null;
  salaryCurrency: string | null;
  salaryPeriod: string | null;
  seniorityLevels: string[];
  willingToRelocate: boolean;
  internationalRemote: boolean;
  excludedCompanies: string[];
  excludedIndustries: string[];
  preferredIndustries: string[];
  minimumMatchScore: number;
  maximumApplicationsPerWeek: number | null;
}

export type AnswerType = "boolean" | "text" | "numeric";

export interface VerifiedApplicationAnswer {
  canonicalKey: string;
  answerType: AnswerType;
  booleanValue: boolean | null;
  textValue: string | null;
  numericValue: number | null;
  userConfirmed: boolean;
}

export interface MasterProfile {
  userId: string;
  identity: MasterProfileIdentity;
  experience: MasterExperience[];
  education: MasterEducation[];
  skills: MasterSkill[];
  languages: MasterLanguage[];
  preferences: MasterPreferences;
  verifiedApplicationAnswers: VerifiedApplicationAnswer[];
  links: { linkedin: string; portfolio: string };
  baseResumePath: string | null;
}

export interface JobRecord {
  id: string;
  externalJobId: string;
  sourceId: string | null;
  companyId: string | null;
  companyName?: string;
  title: string;
  description: string | null;
  location: string | null;
  country: string | null;
  remoteType: string | null;
  employmentType: string | null;
  seniority: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  applicationUrl: string | null;
  atsType: string | null;
  autoApplyEligible: boolean;
  autoApplyAdapter: string | null;
  applicationSchemaId: string | null;
  publishedAt: string | null;
  isActive: boolean;
  rawData: Record<string, unknown>;
}

export type ApplicationFieldType = "text" | "textarea" | "email" | "phone" | "file" | "boolean" | "select" | "numeric" | "date";

export interface ApplicationField {
  key: string;
  label?: string;
  type: ApplicationFieldType;
  required: boolean;
  options?: string[];
  canonicalKey?: string;
}

export interface ApplicationSchema {
  id?: string;
  jobId: string;
  adapter: string;
  schemaVersion: string;
  fields: ApplicationField[];
  requiredFields: string[];
  supportsFileUpload: boolean;
  supportsAutoSubmit: boolean;
  valid: boolean;
}

export type IneligibilityReason =
  | "adapter_submission_unsupported"
  | "adapter_verification_unsupported"
  | "schema_invalid"
  | "schema_missing"
  | "requires_captcha"
  | "requires_mfa"
  | "requires_login"
  | "requires_human_verification"
  | "requires_third_party_account"
  | "missing_required_answer"
  | "missing_resume"
  | "adapter_not_connected";

export interface EligibilityResult {
  eligible: boolean;
  reasons: IneligibilityReason[];
  missingFields: string[];
}

export interface PreparedApplication {
  jobId: string;
  userId: string;
  adapter: string;
  resumeVariantId: string | null;
  resumePdfPath: string | null;
  answers: Record<string, string | number | boolean>;
  schema: ApplicationSchema;
}

export interface SubmissionResult {
  submitted: boolean;
  submissionReference: string | null;
  rawResponse: Record<string, unknown> | null;
  evidencePath: string | null;
  errorCode?: string;
  errorMessage?: string;
}

export interface VerificationResult {
  verified: boolean;
  signal: "api_response" | "application_id" | "confirmation_page" | "confirmation_email" | "none";
  submissionReference: string | null;
  evidencePath: string | null;
}

/** Separate capabilities: discovery does not imply the right to submit. */
export interface AdapterCapabilities {
  discovery: boolean;
  schemaDiscovery: boolean;
  submission: boolean;
  verification: boolean;
  publicDiscoverySupported: boolean;
  authorizedSubmissionSupported: boolean;
  publicFormSubmissionSupported: boolean;
}

export type ConnectionStatus = "not_connected" | "connected" | "degraded";

export interface JobSourceAdapter {
  readonly name: string;
  readonly capabilities: AdapterCapabilities;
  readonly connectionStatus: ConnectionStatus;
  discoverJobs(): Promise<JobRecord[]>;
  getJob(externalJobId: string): Promise<JobRecord | null>;
  getApplicationSchema(job: JobRecord): Promise<ApplicationSchema | null>;
  canAutoApply(job: JobRecord, profile: MasterProfile): Promise<EligibilityResult>;
}

export interface ApplicationAdapter {
  readonly name: string;
  readonly capabilities: AdapterCapabilities;
  readonly connectionStatus: ConnectionStatus;
  prepareApplication(job: JobRecord, profile: MasterProfile): Promise<PreparedApplication>;
  submit(application: PreparedApplication): Promise<SubmissionResult>;
  verifySubmission(result: SubmissionResult): Promise<VerificationResult>;
}

export type AutoApplyAdapter = JobSourceAdapter & ApplicationAdapter;

export type AttemptStatus =
  | "queued"
  | "preparing"
  | "resume_generating"
  | "ready"
  | "submitting"
  | "submitted_unverified"
  | "verified"
  | "failed_retryable"
  | "failed_permanent"
  | "expired"
  | "duplicate"
  | "unsupported";

/**
 * A job is only Auto Apply inventory when the adapter can submit AND verify.
 * Discovery alone never makes a job eligible.
 */
export function isAutoApplyCapable(capabilities: AdapterCapabilities): boolean {
  return capabilities.submission && capabilities.verification;
}
