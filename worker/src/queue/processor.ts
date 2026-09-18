import { loadConfig } from "../config.js";
import { resolveAdapter } from "../adapters/registry.js";
import { withIsolatedPage } from "../browser/context.js";
import {
  prepareAnswers,
  validateGeneratedAnswer,
} from "../application/answers.js";
import { getOrCreateResume } from "../application/resume.js";
import {
  ApplicationError,
  isRetryable,
  makesJobUnsupported,
  toApplicationError,
} from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import {
  claimInspections,
  createUpload,
  heartbeat,
  reportFailure,
  reportInspection,
  reportStatus,
  reportSubmission,
  uploadToGrant,
  type InspectionItem,
  type QueueItem,
} from "./claim.js";
import type { JobRecord, MasterProfile } from "../adapters/types.js";

function normalizePayload(item: QueueItem): {
  job: JobRecord;
  profile: MasterProfile;
} {
  const job: JobRecord = {
    id: item.job.id,
    title: item.job.title,
    description: item.job.description ?? "",
    company: item.company?.name ?? "",
    location: item.job.location,
    applicationUrl: item.job.application_url,
    atsType: item.job.ats_type,
  };

  const profile: MasterProfile = {
    ...item.master_profile,
    verifiedApplicationAnswers: item.verified_answers ?? [],
  };

  return { job, profile };
}

function startHeartbeat(attemptId: string) {
  const interval = setInterval(() => {
    heartbeat(attemptId).catch((error) => {
      logger.warn(
        {
          applicationAttemptId: attemptId,
          err: error instanceof Error ? error.message : String(error),
        },
        "heartbeat failed",
      );
    });
  }, 4 * 60_000);

  return () => clearInterval(interval);
}

/**
 * One application, start to finish:
 * claimed payload → schema → eligibility → CV → answers → submit → verify →
 * evidence → verified. The worker never reads or writes the DB directly.
 */
export async function processApplication(item: QueueItem): Promise<void> {
  const config = loadConfig();
  const log = logger.child({
    queueId: item.queue_id,
    jobId: item.job.id,
    applicationAttemptId: item.application_attempt_id,
  });
  const stopHeartbeat = startHeartbeat(item.application_attempt_id);

  try {
    const { job, profile } = normalizePayload(item);

    if (!item.job.is_active) {
      throw new ApplicationError("JOB_EXPIRED", "The job is no longer active.");
    }
    if (!item.job.auto_apply_eligible) {
      throw new ApplicationError(
        "UNSUPPORTED_FIELD",
        "The job is no longer Auto Apply eligible.",
      );
    }

    await reportStatus(item.queue_id, "preparing");

    const adapter = resolveAdapter(job.applicationUrl);
    if (adapter.id === "unsupported") {
      throw new ApplicationError(
        "UNSUPPORTED_FIELD",
        `No enabled adapter supports ${job.applicationUrl}`,
      );
    }

    await withIsolatedPage(async (page) => {
      const schema = await adapter.inspect(job.applicationUrl, page);
      if (schema.captchaDetected) {
        throw new ApplicationError(
          "CAPTCHA_PRESENT",
          "The application form uses a CAPTCHA.",
        );
      }
      if (schema.loginRequired) {
        throw new ApplicationError(
          "LOGIN_REQUIRED",
          "The application form requires a login.",
        );
      }

      const eligibility = await adapter.canSubmit(schema, profile);
      if (!eligibility.eligible) {
        throw new ApplicationError(
          eligibility.failureCode ?? "UNSUPPORTED_FIELD",
          eligibility.reasons.join("; "),
          { unknownRequiredFields: eligibility.unknownRequiredFields },
        );
      }

      await reportStatus(item.queue_id, "resume_generating");
      const resume = await getOrCreateResume(
        job,
        profile,
        item.application_attempt_id,
      );

      const answers = prepareAnswers(schema, profile, job);
      for (const answer of answers.filter((a) => a.source === "generated")) {
        const validation = validateGeneratedAnswer(
          String(answer.value),
          profile,
          job,
        );
        if (!validation.valid) {
          throw new ApplicationError(
            "UNSUPPORTED_FIELD",
            `Generated answer contains unsupported claims: ${validation.unsupportedClaims.join(", ")}`,
          );
        }
      }

      await reportStatus(item.queue_id, "ready");
      await reportStatus(item.queue_id, "submitting");

      const submission = await adapter.submit({
        job,
        profile,
        schema,
        answers,
        resumePath: resume.localPath,
        page,
        dryRun: config.DRY_RUN,
      });

      if (submission.dryRun) {
        log.info("dry run completed successfully before final submit");
        await reportFailure(item.queue_id, {
          errorCode: "DRY_RUN_COMPLETE",
          errorMessage:
            "Dry run completed successfully; final submit intentionally skipped.",
          retryable: false,
          status: "failed_permanent",
        });
        return;
      }

      await reportStatus(item.queue_id, "submitted_unverified");
      const verification = await adapter.verify(submission);
      if (!verification.verified) {
        await reportSubmission(item.queue_id, {
          verified: false,
          verificationSignal: null,
        });
        throw new ApplicationError(
          "VERIFICATION_FAILED",
          "The submission could not be independently verified.",
        );
      }

      let evidencePath: string | null = null;
      if (verification.screenshot) {
        const grant = await createUpload(
          item.application_attempt_id,
          "evidence",
          "image/png",
        );
        evidencePath = await uploadToGrant(grant, verification.screenshot);
      }

      await reportSubmission(item.queue_id, {
        verified: true,
        verificationSignal: verification.verificationType,
        verificationType: verification.verificationType,
        verificationValue: verification.verificationValue,
        submissionReference:
          verification.verificationValue ??
          `${adapter.id}:${item.application_attempt_id}`,
        evidencePath,
        resumeVariantId: resume.resumeVariantId,
        answers: answers.map((answer) => ({
          label: answer.field.label,
          canonicalKey: answer.field.canonicalKey,
          type: answer.field.type,
          value: answer.field.type === "file" ? "CV adjunto" : answer.value,
          source: answer.source,
        })),
        profileSnapshot: profile,
        jobSnapshot: {
          id: job.id,
          title: job.title,
          company: job.company,
          location: job.location,
          url: job.applicationUrl,
          description: job.description,
          adapter: adapter.id,
          adapterVersion: adapter.version,
          resumePath: resume.pdfPath,
          verificationType: verification.verificationType,
          verificationValue: verification.verificationValue,
        },
      });

      log.info(
        { verification: verification.verificationType },
        "application verified",
      );
    });
  } catch (error) {
    const appError = toApplicationError(error);
    log.error(
      { code: appError.code, err: appError.message },
      "application failed",
    );

    await reportFailure(item.queue_id, {
      errorCode: appError.code,
      errorMessage: appError.message,
      retryable: isRetryable(appError.code),
      delaySeconds: 600,
      status:
        appError.code === "JOB_EXPIRED"
          ? "expired"
          : appError.code === "DUPLICATE_APPLICATION"
            ? "duplicate"
            : makesJobUnsupported(appError.code)
              ? "unsupported"
              : "failed_permanent",
    }).catch((reportError) =>
      log.error({ err: String(reportError) }, "could not report failure"),
    );
  } finally {
    stopHeartbeat();
  }
}

/** Admin adapter test console: inspect a URL without submitting. */
export async function processInspection(item: InspectionItem): Promise<void> {
  const log = logger.child({ inspectionId: item.id });

  try {
    const adapter = resolveAdapter(item.url);
    if (adapter.id === "unsupported") {
      await reportInspection(item.id, {
        status: "completed",
        adapter: "unsupported",
        atsType: "unknown",
        autoApplyEligible: false,
        reason: "Ningún adaptador habilitado soporta esta URL.",
      });
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
        mappedFields: schema.fields
          .filter((f) => f.canonicalKey)
          .map((f) => ({
            label: f.label,
            canonicalKey: f.canonicalKey,
            type: f.type,
            required: f.required,
          })),
        unknownFields: schema.fields
          .filter((f) => !f.canonicalKey)
          .map((f) => ({
            label: f.label,
            type: f.type,
            required: f.required,
          })),
        autoApplyEligible:
          schema.valid &&
          schema.supportsFileUpload &&
          schema.unknownRequiredFields.length === 0,
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
    await reportInspection(item.id, {
      status: "failed",
      errorCode: appError.code,
      errorMessage: appError.message,
      autoApplyEligible: false,
    });
  }
}

export async function drainInspections(): Promise<number> {
  const items = await claimInspections(2);
  for (const item of items) await processInspection(item);
  return items.length;
}
