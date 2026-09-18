import { loadConfig } from "../config.js";
import { resolveAdapter } from "../adapters/registry.js";
import { withIsolatedPage } from "../browser/context.js";
import { prepareAnswers, generatedInterest, validateGeneratedAnswer } from "../application/answers.js";
import { assertNotDuplicate, loadJob, loadMasterProfile } from "../application/prepare.js";
import { getOrCreateResume } from "../application/resume.js";
import { markJobUnsupported, storeEvidence, storeSnapshot } from "../application/verify.js";
import { ApplicationError, isRetryable, makesJobUnsupported, toApplicationError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { claimInspections, reportFailure, reportInspection, reportStatus, reportSubmission, type InspectionItem, type QueueItem } from "./claim.js";

/**
 * One application, start to finish:
 * job → profile → schema → eligibility → CV → answers → submit → verify →
 * evidence → snapshot → verified (and only then, one credit).
 */
export async function processApplication(item: QueueItem): Promise<void> {
  const config = loadConfig();
  const log = logger.child({ queueId: item.id, jobId: item.job_id });

  try {
    await reportStatus(item.id, "preparing");
    const job = await loadJob(item.job_id);
    const profile = await loadMasterProfile(item.user_id);
    await assertNotDuplicate(item.user_id, item.job_id);

    const adapter = resolveAdapter(job.applicationUrl);
    if (adapter.id === "unsupported") throw new ApplicationError("UNSUPPORTED_FIELD", `No enabled adapter supports ${job.applicationUrl}`);

    await withIsolatedPage(async (page) => {
      const schema = await adapter.inspect(job.applicationUrl, page);
      if (schema.captchaDetected) throw new ApplicationError("CAPTCHA_PRESENT", "The application form uses a CAPTCHA.");
      if (schema.loginRequired) throw new ApplicationError("LOGIN_REQUIRED", "The application form requires a login.");

      const eligibility = await adapter.canSubmit(schema, profile);
      if (!eligibility.eligible) {
        throw new ApplicationError(eligibility.failureCode ?? "UNSUPPORTED_FIELD", eligibility.reasons.join("; "), { unknownRequiredFields: eligibility.unknownRequiredFields });
      }

      await reportStatus(item.id, "resume_generating");
      const resume = await getOrCreateResume(job, profile);

      const answers = prepareAnswers(schema, profile, job);
      // Any free-text answer we composed must trace back to MasterProfile facts.
      const freeText = answers.filter((a) => a.source === "generated");
      for (const answer of freeText) {
        const validation = validateGeneratedAnswer(String(answer.value), profile, job);
        if (!validation.valid) {
          throw new ApplicationError("UNSUPPORTED_FIELD", `Generated answer contains unsupported claims: ${validation.unsupportedClaims.join(", ")}`);
        }
      }
      void generatedInterest;

      await reportStatus(item.id, "submitting");
      const submission = await adapter.submit({ job, profile, schema, answers, resumePath: resume.localPath, page, dryRun: config.DRY_RUN });

      if (submission.dryRun) {
        log.warn("dry run: stopped before final submit, no credit consumed");
        await reportFailure(item.id, { errorCode: "VERIFICATION_FAILED", errorMessage: "Dry run: se completó todo menos el envío final.", retryable: false, status: "unsupported" });
        return;
      }

      const verification = await adapter.verify(submission);
      if (!verification.verified) {
        // Submitted but unverified: reported as such, never as "Enviada", no credit.
        await reportSubmission(item.id, { verified: false, verificationSignal: null });
        throw new ApplicationError("VERIFICATION_FAILED", "The submission could not be independently verified.");
      }

      const evidencePath = verification.screenshot ? await storeEvidence(item.user_id, item.attempt_id, verification.screenshot) : null;
      await storeSnapshot({
        attemptId: item.attempt_id,
        userId: item.user_id,
        resumeVariantId: resume.resumeVariantId,
        job,
        profile,
        answers,
        verification,
        adapter: adapter.id,
        adapterVersion: adapter.version,
      });

      await reportSubmission(item.id, {
        verified: true,
        verificationSignal: verification.verificationType,
        verificationType: verification.verificationType,
        verificationValue: verification.verificationValue,
        submissionReference: verification.verificationValue ?? `${adapter.id}:${Date.now()}`,
        evidencePath,
        resumeVariantId: resume.resumeVariantId,
      });
      log.info({ verification: verification.verificationType }, "application verified");
    });
  } catch (error) {
    const appError = toApplicationError(error);
    log.error({ code: appError.code, err: appError.message }, "application failed");
    if (makesJobUnsupported(appError.code)) await markJobUnsupported(item.job_id, appError.code);
    await reportFailure(item.id, {
      errorCode: appError.code,
      errorMessage: appError.message,
      retryable: isRetryable(appError.code),
      delaySeconds: 600,
      status: appError.code === "JOB_EXPIRED" ? "expired" : appError.code === "DUPLICATE_APPLICATION" ? "duplicate" : makesJobUnsupported(appError.code) ? "unsupported" : "failed_permanent",
    }).catch((reportError) => log.error({ err: String(reportError) }, "could not report failure"));
  }
}

/** Admin adapter test console: inspect a URL, optionally as a dry run. */
export async function processInspection(item: InspectionItem): Promise<void> {
  const log = logger.child({ inspectionId: item.id });
  try {
    const adapter = resolveAdapter(item.url);
    if (adapter.id === "unsupported") {
      await reportInspection(item.id, { status: "completed", adapter: "unsupported", atsType: "unknown", autoApplyEligible: false, reason: "Ningún adaptador habilitado soporta esta URL." });
      return;
    }

    await withIsolatedPage(async (page) => {
      const schema = await adapter.inspect(item.url, page);
      await reportInspection(item.id, {
        status: "completed",
        adapter: adapter.id,
        adapterVersion: adapter.version,
        atsType: schema.atsType,
        captchaDetected: schema.captchaDetected,
        loginRequired: schema.loginRequired,
        requiredFields: schema.requiredFields,
        mappedFields: schema.fields.filter((f) => f.canonicalKey).map((f) => ({ label: f.label, canonicalKey: f.canonicalKey, type: f.type, required: f.required })),
        unknownFields: schema.fields.filter((f) => !f.canonicalKey).map((f) => ({ label: f.label, type: f.type, required: f.required })),
        autoApplyEligible: schema.valid && schema.supportsFileUpload && schema.unknownRequiredFields.length === 0,
        reason: schema.captchaDetected
          ? "CAPTCHA detectado"
          : schema.loginRequired
            ? "Requiere iniciar sesión"
            : schema.unknownRequiredFields.length
              ? `Preguntas obligatorias no soportadas: ${schema.unknownRequiredFields.join(", ")}`
              : !schema.supportsFileUpload
                ? "El formulario no acepta subir un CV"
                : !schema.submitSelector
                  ? "No se encontró el control de envío"
                  : null,
      });
    });
  } catch (error) {
    const appError = toApplicationError(error);
    log.error({ code: appError.code }, "inspection failed");
    await reportInspection(item.id, { status: "failed", errorCode: appError.code, errorMessage: appError.message, autoApplyEligible: false });
  }
}

export async function drainInspections(): Promise<number> {
  const items = await claimInspections(2);
  for (const item of items) await processInspection(item);
  return items.length;
}
