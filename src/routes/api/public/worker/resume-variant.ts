import { createFileRoute } from "@tanstack/react-router";
import {
  assertWorker,
  audit,
  jsonResponse,
  loadOwnedAttempt,
  workerDb,
  workerLog,
} from "@/lib/worker-api.server";

/**
 * Persists the validated resume variant for one claimed application.
 * The worker cannot choose user_id/job_id; they are derived from the owned attempt.
 */
export const Route = createFileRoute("/api/public/worker/resume-variant")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = assertWorker(request);
        if (auth) return auth;

        const body = (await request.json().catch(() => ({}))) as {
          application_attempt_id?: string;
          worker_id?: string;
          pdf_path?: string;
          structured_resume?: Record<string, unknown>;
          professional_summary?: string;
          selected_experience_ids?: string[];
          selected_skill_ids?: string[];
          generated_bullets?: unknown[];
          html?: string;
          validation_status?: string;
          validation_issues?: unknown[];
          master_profile_version?: number;
        };

        const attemptId = body.application_attempt_id ?? "";
        if (!attemptId || body.validation_status !== "passed" || !body.pdf_path) {
          return jsonResponse({ error: "invalid_request" }, 400);
        }

        const db = workerDb();
        const owned = await loadOwnedAttempt(db, attemptId, body.worker_id);
        if (!owned || !owned.queueId) return jsonResponse({ error: "not_owned" }, 403);

        const { data: profile } = await db
          .from("profiles")
          .select("master_profile_version")
          .eq("user_id", owned.userId)
          .maybeSingle();
        const profileVersion = profile?.master_profile_version ?? 1;
        if (
          body.master_profile_version !== undefined &&
          body.master_profile_version !== profileVersion
        ) {
          return jsonResponse({ error: "stale_profile_version" }, 409);
        }

        const { data: saved, error } = await db
          .from("resume_variants")
          .upsert(
            {
              user_id: owned.userId,
              job_id: owned.jobId,
              master_profile_version: profileVersion,
              structured_resume: (body.structured_resume ?? {}) as never,
              professional_summary: (body.professional_summary ?? "").slice(0, 4000),
              selected_experience_ids: body.selected_experience_ids ?? [],
              selected_skill_ids: body.selected_skill_ids ?? [],
              generated_bullets: (body.generated_bullets ?? []) as never,
              html: body.html ?? null,
              pdf_path: body.pdf_path,
              validation_status: "passed",
              validation_issues: (body.validation_issues ?? []) as never,
            },
            { onConflict: "user_id,job_id,master_profile_version" },
          )
          .select("id")
          .single();

        if (error || !saved) {
          return jsonResponse({ error: error?.message ?? "resume_variant_failed" }, 500);
        }

        await db
          .from("application_attempts")
          .update({ resume_variant_id: saved.id })
          .eq("id", attemptId);

        await audit(
          db,
          { userId: owned.userId, jobId: owned.jobId, attemptId },
          "resume_created",
          { resume_variant_id: saved.id, profile_version: profileVersion },
        );
        workerLog("resume_variant_saved", {
          application_attempt_id: attemptId,
          job_id: owned.jobId,
        });

        return jsonResponse({ id: saved.id });
      },
    },
  },
});
