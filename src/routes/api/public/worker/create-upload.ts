import { createFileRoute } from "@tanstack/react-router";
import { EVIDENCE_BUCKET, RESUME_BUCKET, UPLOAD_URL_TTL_SECONDS, assertWorker, jsonResponse, loadOwnedAttempt, workerDb, workerLog } from "@/lib/worker-api.server";

/**
 * POST /api/public/worker/create-upload
 * Short-lived signed upload URL for exactly one file, at a path derived from the
 * claimed attempt. The worker never receives Storage credentials, and cannot
 * choose the bucket or the path.
 */
export const Route = createFileRoute("/api/public/worker/create-upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = assertWorker(request);
        if (auth) return auth;
        const body = (await request.json().catch(() => ({}))) as { application_attempt_id?: string; type?: string; content_type?: string; worker_id?: string };
        const attemptId = body.application_attempt_id ?? "";
        const kind = body.type;
        if (!attemptId || (kind !== "resume" && kind !== "evidence")) return jsonResponse({ error: "invalid_request" }, 400);

        const expectedContentType = kind === "resume" ? "application/pdf" : "image/png";
        if (body.content_type && body.content_type !== expectedContentType) return jsonResponse({ error: "unsupported_content_type", expected: expectedContentType }, 400);

        const db = workerDb();
        const owned = await loadOwnedAttempt(db, attemptId, body.worker_id);
        if (!owned) return jsonResponse({ error: "not_owned" }, 403);

        const bucket = kind === "resume" ? RESUME_BUCKET : EVIDENCE_BUCKET;
        const storagePath = kind === "resume" ? `${owned.userId}/${owned.jobId}-${owned.attemptId}.pdf` : `${owned.userId}/${owned.attemptId}.png`;

        const { data, error } = await db.storage.from(bucket).createSignedUploadUrl(storagePath, { upsert: true });
        if (error || !data) return jsonResponse({ error: error?.message ?? "could_not_sign_upload" }, 500);

        workerLog("upload_signed", { application_attempt_id: owned.attemptId, job_id: owned.jobId, kind });
        return jsonResponse({ upload_url: data.signedUrl, token: data.token, storage_path: storagePath, bucket, content_type: expectedContentType, expires_in: UPLOAD_URL_TTL_SECONDS });
      },
    },
  },
});
