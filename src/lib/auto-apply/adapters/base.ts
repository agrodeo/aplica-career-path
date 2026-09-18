import type {
  AdapterCapabilities,
  ApplicationSchema,
  AutoApplyAdapter,
  ConnectionStatus,
  EligibilityResult,
  IneligibilityReason,
  JobRecord,
  MasterProfile,
  PreparedApplication,
  SubmissionResult,
  VerificationResult,
} from "../types";
import { isAutoApplyCapable } from "../types";

export class AdapterNotConnectedError extends Error {
  constructor(adapter: string, operation: string) {
    super(`Adapter "${adapter}" is not connected: ${operation} requires an authorized integration.`);
    this.name = "AdapterNotConnectedError";
  }
}

/**
 * Shared adapter behaviour. Concrete adapters override only what they truly
 * support. Nothing here fakes a network call or a successful submission.
 */
export abstract class BaseAdapter implements AutoApplyAdapter {
  abstract readonly name: string;
  abstract readonly capabilities: AdapterCapabilities;
  readonly connectionStatus: ConnectionStatus = "not_connected";

  async discoverJobs(): Promise<JobRecord[]> {
    if (!this.capabilities.discovery) return [];
    throw new AdapterNotConnectedError(this.name, "discoverJobs");
  }

  async getJob(_externalJobId: string): Promise<JobRecord | null> {
    if (!this.capabilities.discovery) return null;
    throw new AdapterNotConnectedError(this.name, "getJob");
  }

  async getApplicationSchema(_job: JobRecord): Promise<ApplicationSchema | null> {
    if (!this.capabilities.schemaDiscovery) return null;
    throw new AdapterNotConnectedError(this.name, "getApplicationSchema");
  }

  /**
   * Eligibility is conservative by design: any unknown or blocked requirement
   * keeps the job out of the Auto Apply inventory.
   */
  async canAutoApply(job: JobRecord, profile: MasterProfile): Promise<EligibilityResult> {
    const reasons: IneligibilityReason[] = [];
    const missingFields: string[] = [];

    if (this.connectionStatus !== "connected") reasons.push("adapter_not_connected");
    if (!this.capabilities.submission) reasons.push("adapter_submission_unsupported");
    if (!this.capabilities.verification) reasons.push("adapter_verification_unsupported");
    if (!profile.baseResumePath) missingFields.push("resume");

    const schema = this.capabilities.schemaDiscovery ? await this.getApplicationSchema(job).catch(() => null) : null;
    if (!schema) {
      reasons.push("schema_missing");
    } else {
      if (!schema.valid || !schema.supportsAutoSubmit) reasons.push("schema_invalid");
      for (const key of schema.requiredFields) {
        const answered = profile.verifiedApplicationAnswers.some((a) => a.canonicalKey === key && a.userConfirmed);
        const identityCovered = ["first_name", "last_name", "email", "phone", "resume", "location"].includes(key);
        if (!answered && !identityCovered) missingFields.push(key);
      }
      if (missingFields.length) reasons.push("missing_required_answer");
    }

    return { eligible: reasons.length === 0 && missingFields.length === 0 && isAutoApplyCapable(this.capabilities), reasons, missingFields };
  }

  async prepareApplication(_job: JobRecord, _profile: MasterProfile): Promise<PreparedApplication> {
    throw new AdapterNotConnectedError(this.name, "prepareApplication");
  }

  async submit(_application: PreparedApplication): Promise<SubmissionResult> {
    throw new AdapterNotConnectedError(this.name, "submit");
  }

  async verifySubmission(_result: SubmissionResult): Promise<VerificationResult> {
    return { verified: false, signal: "none", submissionReference: null, evidencePath: null };
  }
}
