import { createFileRoute } from "@tanstack/react-router";
import {
  assertWorker,
  audit,
  jsonResponse,
  loadOwnedQueue,
  workerDb,
  workerLog,
} from "@/lib/worker-api.server";

/**
 * POST /api/public/worker/jobs/:id/submission
 * A credit is consumed only after a strong verification signal is recorded.
 */
export const Route = createFileRoute("/api/public/worker/jobs/$id/submission")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const auth = assertWorker(request);
        if (auth) return auth;

        const body = (await request.json().catch(() => ({}))) as {
          worker_id?: string;
          verified?: boolean;
          verificationSignal?: string;
          verificationType?: string;
          verificationValue?: string;
          submissionReference?: string;
          evidencePath?: string | null;
          answers?: Record<string, unknown> | unknown[];
          profileSnapshot?: Record<string, unknown>;
          jobSnapshot?: Record<string, unknown>;
          resumeVariantId?: string;
        };

        const workerId = (body.worker_id ?? "").slice(0, 64);
        if (!workerId) return jsonResponse({ error: "worker_id_required" }, 400);

        const db = workerDb();
        const owned = await loadOwnedQueue(db, params.id, workerId);
        if (!owned) return jsonResponse({ error: "not_owned" }, 403);

        if (
          body.verified !== true ||
          !body.verificationSignal ||
          !body.submissionReference
        ) {
          const { data, error } = await db.rpc("update_attempt_status", {
            _queue_id: params.id,
            _status: "submitted_unverified",
          });
          if (error) return jsonResponse({ error: error.message }, 500);
          return jsonResponse({
            result: data,
            note: "verification_required_before_credit",
          });
        }

        // Snapshot before completion removes the queue row. Upsert-like guard
        // keeps retries idempotent.
        const { data: existingSnapshot } = await db
          .from("application_snapshots")
          .select("id")
          .eq("application_attempt_id", owned.attemptId)
          .maybeSingle();

        if (!existingSnapshot) {
          const { error: snapshotError } = await db
            .from("application_snapshots")
            .insert({
              application_attempt_id: owned.attemptId,
              user_id: owned.userId,
              resume_variant_id: body.resumeVariantId ?? null,
              answers: (body.answers ?? {}) as never,
              profile_snapshot: (body.profileSnapshot ?? {}) as never,
              job_snapshot: (body.jobSnapshot ?? {}) as never,
            });
          if (snapshotError) {
            return jsonResponse({ error: snapshotError.message }, 500);
          }
        }

        await db
          .from("application_attempts")
          .update({
            verification_type:
              body.verificationType ?? body.verificationSignal,
            verification_value:
              body.verificationValue ?? body.submissionReference,
            resume_variant_id: body.resumeVariantId ?? null,
          })
          .eq("id", owned.attemptId);

        const { data, error } = await db.rpc("complete_application", {
          _queue_id: params.id,
          _submission_reference: body.submissionReference,
          ...(body.evidencePath
            ? { _evidence_path: body.evidencePath }
            : {}),
        });
        if (error) return jsonResponse({ error: error.message }, 500);

        await audit(
          db,
          {
            userId: owned.userId,
            jobId: owned.jobId,
            attemptId: owned.attemptId,
          },
          "worker_submission_verified",
          { verification_type: body.verificationType ?? body.verificationSignal },
        );
        workerLog("application_verified", {
          application_attempt_id: owned.attemptId,
          job_id: owned.jobId,
        });

        return jsonResponse({ result: data });
      },
    },
  },
});
