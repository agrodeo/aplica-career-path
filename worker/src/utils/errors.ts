/** Normalized failure taxonomy shared by adapters, the queue and the backend. */
export const FAILURE_CODES = [
  "JOB_EXPIRED",
  "DUPLICATE_APPLICATION",
  "UNSUPPORTED_FIELD",
  "CAPTCHA_PRESENT",
  "LOGIN_REQUIRED",
  "AUTOMATION_BLOCKED",
  "FILE_UPLOAD_FAILED",
  "FORM_CHANGED",
  "NETWORK_ERROR",
  "SUBMISSION_REJECTED",
  "VERIFICATION_FAILED",
  "UNKNOWN_ERROR",
] as const;

export type FailureCode = (typeof FAILURE_CODES)[number];

/** Only transient problems are retried. Blocked/unsupported cases never are. */
const TRANSIENT: FailureCode[] = ["NETWORK_ERROR", "FORM_CHANGED", "FILE_UPLOAD_FAILED", "UNKNOWN_ERROR"];

/** These make the job unsupported inventory: it leaves the Auto Apply list. */
const MAKES_JOB_UNSUPPORTED: FailureCode[] = ["UNSUPPORTED_FIELD", "CAPTCHA_PRESENT", "LOGIN_REQUIRED", "AUTOMATION_BLOCKED"];

export function isRetryable(code: FailureCode): boolean {
  return TRANSIENT.includes(code);
}

export function makesJobUnsupported(code: FailureCode): boolean {
  return MAKES_JOB_UNSUPPORTED.includes(code);
}

export class ApplicationError extends Error {
  constructor(
    readonly code: FailureCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApplicationError";
  }
}

export function toApplicationError(error: unknown): ApplicationError {
  if (error instanceof ApplicationError) return error;
  const message = error instanceof Error ? error.message : String(error);
  if (/net::|ECONNRESET|ETIMEDOUT|timeout/i.test(message)) return new ApplicationError("NETWORK_ERROR", message);
  return new ApplicationError("UNKNOWN_ERROR", message);
}
