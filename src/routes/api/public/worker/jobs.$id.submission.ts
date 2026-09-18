import { createFileRoute } from "@tanstack/react-router";
import { assertWorker, jsonResponse, workerAdmin } from "@/lib/worker-auth.server";

/**
 * POST /api/public/worker/jobs/:id/submission
 * Only a VERIFIED submission may be reported here: the worker must provide a
 * verification signal and reference. A credit is consumed at this point only.
 */
export const Route = createFileRoute("/api/public/worker/jobs/$id/submission")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const auth = assertWorker(request);
        if (auth) return auth;
        const body = (await request.json().catch(() => ({}))) as {
          verified?: boolean;
          verificationSignal?: string;
          submissionReference?: string;
          evidencePath?: string;
          answers?: Record<string, unknown>;
          profileSnapshot?: Record<string, unknown>;
          jobSnapshot?: Record<string, unknown>;
          resumeVariantId?: string;
        };

        const admin = await workerAdmin();

        if (body.verified !== true || !body.verificationSignal || !body.submissionReference) {
          // Submitted but not verified: never reported to the user as "Enviada".
          const { data, error } = await admin.rpc("update_attempt_status", { _queue_id: params.id, _status: "submitted_unverified" });
          if (error) return jsonResponse({ error: error.message }, 500);
          return jsonResponse({ result: data, note: "verification_required_before_credit" });
        }

        const { data: queueRow } = await admin.from("application_queue").select("user_id, job_id, attempt_id").eq("id", params.id).maybeSingle();

        const { data, error } = await admin.rpc("complete_application", {
          _queue_id: params.id,
          _submission_reference: body.submissionReference,
          ...(body.evidencePath ? { _evidence_path: body.evidencePath } : {}),
        });
        if (error) return jsonResponse({ error: error.message }, 500);

        if (queueRow?.attempt_id) {
          await admin.from("application_snapshots").insert({
            application_attempt_id: queueRow.attempt_id,
            user_id: queueRow.user_id,
            resume_variant_id: body.resumeVariantId ?? null,
            answers: (body.answers ?? {}) as never,
            profile_snapshot: (body.profileSnapshot ?? {}) as never,
            job_snapshot: (body.jobSnapshot ?? {}) as never,
          });
        }

        return jsonResponse({ result: data });
      },
    },
  },
});
