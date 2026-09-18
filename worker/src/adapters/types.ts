import type { Page } from "playwright";
import type { FailureCode } from "../utils/errors.js";

export const CANONICAL_KEYS = [
  "first_name",
  "last_name",
  "full_name",
  "email",
  "phone",
  "location",
  "country",
  "linkedin",
  "portfolio",
  "website",
  "resume",
  "cover_letter",
  "motivation",
  "about_you",
  "challenge_story",
  "proud_achievement",
  "current_company",
  "current_title",
  "work_authorization",
  "sponsorship",
  "salary_expectation",
  "relocation",
  "notice_period",
  "years_experience",
] as const;

export type CanonicalKey = (typeof CANONICAL_KEYS)[number];

/** Answers that must never be inferred — only explicitly stored user answers. */
export const SENSITIVE_KEYS: string[] = [
  "work_authorization",
  "sponsorship",
  "salary_expectation",
  "disability",
  "veteran_status",
  "gender",
  "race",
  "ethnicity",
  "criminal_history",
];

export type FieldType = "text" | "email" | "tel" | "textarea" | "select" | "radio" | "checkbox" | "file" | "unknown";

export interface InspectedField {
  selector: string;
  label: string;
  /** Stable key used to look up an explicit stored answer. */
  answerKey: string;
  type: FieldType;
  required: boolean;
  options?: { label: string; value: string }[];
  canonicalKey: CanonicalKey | null;
  /** Optional demographic/EEO question: answered only with an explicit decline option. */
  demographic: boolean;
}

export interface ApplicationSchema {
  url: string;
  adapter: string;
  adapterVersion: string;
  atsType: string;
  fields: InspectedField[];
  requiredFields: string[];
  unknownRequiredFields: string[];
  supportsFileUpload: boolean;
  supportsAutoSubmit: boolean;
  captchaDetected: boolean;
  loginRequired: boolean;
  submitSelector: string | null;
  valid: boolean;
}

export interface CareerContext {
  preferredTasks: string[];
  avoidTasks: string[];
  strengths: string[];
  differentiators: string[];
  tools: string[];
  responsibilities: string[];
  results: string[];
  proudProject: string;
  challengeStory: string;
  careerGoal: string;
  targetEnvironment: string;
  availability: string;
  travelPreference: string;
}

export interface WritingPreferences {
  voice: "direct" | "ambitious" | "technical" | "balanced";
  emphasis: string[];
  deEmphasis: string[];
  summaryStyle: string;
}

export interface ResumeFact {
  id: string;
  factType: string;
  claim: string;
  sourceType: string;
  sourceRef: string | null;
  userConfirmed: boolean;
  allowedForResume: boolean;
  confidence: number;
}

export interface MasterProfile {
  userId: string;
  masterProfileVersion: number;
  identity: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    city: string;
    country: string;
    currentTitle: string;
    professionalSummary: string;
  };
  experience: {
    id: string;
    company: string;
    title: string;
    startDate: string | null;
    endDate: string | null;
    isCurrent: boolean;
    description: string;
    achievements: string[];
  }[];
  education: { id: string; institution: string; degree: string; field: string; startDate: string | null; endDate: string | null }[];
  skills: { id: string; name: string }[];
  languages: { language: string; level: string }[];
  verifiedApplicationAnswers: {
    canonicalKey: string;
    answerType: "boolean" | "text" | "numeric";
    booleanValue: boolean | null;
    textValue: string | null;
    numericValue: number | null;
    userConfirmed: boolean;
  }[];
  links: { linkedin: string; portfolio: string };
  careerContext: CareerContext;
  writingPreferences: WritingPreferences;
  facts: ResumeFact[];
}

export interface JobRecord {
  id: string;
  title: string;
  description: string;
  company: string;
  location: string | null;
  applicationUrl: string;
  atsType: string | null;
}

export interface EligibilityResult {
  eligible: boolean;
  failureCode?: FailureCode;
  reasons: string[];
  unknownRequiredFields: string[];
}

export interface PreparedAnswer {
  field: InspectedField;
  value: string | boolean;
  source: "profile" | "verified_answer" | "generated" | "decline";
}

export interface SubmissionContext {
  job: JobRecord;
  profile: MasterProfile;
  schema: ApplicationSchema;
  answers: PreparedAnswer[];
  resumePath: string;
  page: Page;
  dryRun: boolean;
}

export interface SubmissionResult {
  submitted: boolean;
  dryRun: boolean;
  page: Page;
  adapter: string;
  adapterVersion: string;
  responseUrl: string | null;
  pageText: string | null;
}

export interface VerificationResult {
  verified: boolean;
  verificationType: "confirmation_page" | "application_identifier" | "success_message" | "api_response" | "none";
  verificationValue: string | null;
  screenshot: Buffer | null;
}

export type SubmissionMechanism = "AUTHORIZED_API" | "PUBLIC_APPLICATION_FORM" | "UNSUPPORTED";

export interface ApplicationAdapter {
  readonly id: string;
  readonly version: string;
  readonly mechanism: SubmissionMechanism;
  supports(url: string): boolean;
  inspect(url: string, page: Page): Promise<ApplicationSchema>;
  canSubmit(schema: ApplicationSchema, profile: MasterProfile): Promise<EligibilityResult>;
  submit(context: SubmissionContext): Promise<SubmissionResult>;
  verify(result: SubmissionResult): Promise<VerificationResult>;
}
