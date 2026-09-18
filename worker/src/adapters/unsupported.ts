import type { ApplicationAdapter, ApplicationSchema, EligibilityResult, SubmissionContext, SubmissionResult, VerificationResult } from "./types.js";
import { ApplicationError } from "../utils/errors.js";

/** Terminal adapter: anything Aplica cannot submit and verify end to end. */
export const unsupportedAdapter: ApplicationAdapter = {
  id: "unsupported",
  version: "1.0.0",
  mechanism: "UNSUPPORTED",
  supports: () => true,
  async inspect(url): Promise<ApplicationSchema> {
    return {
      url,
      adapter: "unsupported",
      adapterVersion: "1.0.0",
      atsType: "unknown",
      fields: [],
      requiredFields: [],
      unknownRequiredFields: [],
      supportsFileUpload: false,
      supportsAutoSubmit: false,
      captchaDetected: false,
      loginRequired: false,
      submitSelector: null,
      valid: false,
    };
  },
  async canSubmit(): Promise<EligibilityResult> {
    return { eligible: false, failureCode: "UNSUPPORTED_FIELD", reasons: ["No hay un adaptador soportado para esta postulación."], unknownRequiredFields: [] };
  },
  async submit(_context: SubmissionContext): Promise<SubmissionResult> {
    throw new ApplicationError("UNSUPPORTED_FIELD", "Unsupported application: no adapter can submit this form.");
  },
  async verify(): Promise<VerificationResult> {
    return { verified: false, verificationType: "none", verificationValue: null, screenshot: null };
  },
};
