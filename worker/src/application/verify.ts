import { EVIDENCE_BUCKET } from "../config.js";
import { db } from "../supabase.js";
import { logger } from "../utils/logger.js";
import type { JobRecord, MasterProfile, PreparedAnswer, VerificationResult } from "../adapters/types.js";

/** Stores the post-submission screenshot privately. Returns its storage path. */
export async function storeEvidence(userId: string, attemptId: string, screenshot: Buffer): Promise<string | null> {
  const path = `${userId}/${attemptId}.png`;
  const { error } = await db().storage.from(EVIDENCE_BUCKET).upload(path, screenshot, { contentType: "image/png", upsert: true });
  if (error) {
    logger.error({ err: error.message }, "could not store submission evidence");
    return null;
  }
  return path;
}

/**
 * Records exactly what was sent, so the user can later open
 * "What did Aplica send?" and see the CV, the answers and the job as it was.
 */
export async function storeSnapshot(params: {
  attemptId: string;
  userId: string;
  resumeVariantId: string;
  job: JobRecord;
  profile: MasterProfile;
  answers: PreparedAnswer[];
  verification: VerificationResult;
  adapter: string;
  adapterVersion: string;
}): Promise<void> {
  const { error } = await db()
    .from("application_snapshots")
    .insert({
      application_attempt_id: params.attemptId,
      user_id: params.userId,
      resume_variant_id: params.resumeVariantId,
      answers: params.answers.map((a) => ({ label: a.field.label, canonicalKey: a.field.canonicalKey, type: a.field.type, value: a.field.type === "file" ? "CV adjunto" : a.value, source: a.source })),
      profile_snapshot: params.profile as unknown as Record<string, unknown>,
      job_snapshot: {
        id: params.job.id,
        title: params.job.title,
        company: params.job.company,
        location: params.job.location,
        url: params.job.applicationUrl,
        description: params.job.description,
        adapter: params.adapter,
        adapterVersion: params.adapterVersion,
        verificationType: params.verification.verificationType,
        verificationValue: params.verification.verificationValue,
      },
    });
  if (error) logger.error({ err: error.message }, "could not store application snapshot");
}

/** Marks the job unsupported so it leaves the Auto Apply inventory. */
export async function markJobUnsupported(jobId: string, reason: string): Promise<void> {
  await db().from("jobs").update({ auto_apply_eligible: false, submission_mechanism: "UNSUPPORTED", ineligibility_reason: reason }).eq("id", jobId);
}
