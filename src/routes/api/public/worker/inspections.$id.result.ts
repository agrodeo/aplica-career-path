import { createFileRoute } from "@tanstack/react-router";
import { assertWorker, jsonResponse, workerAdmin } from "@/lib/worker-auth.server";

/** POST /api/public/worker/inspections/:id/result — inspection outcome. */
export const Route = createFileRoute("/api/public/worker/inspections/$id/result")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const auth = assertWorker(request);
        if (auth) return auth;
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

        const admin = await workerAdmin();
        const { error } = await admin
          .from("adapter_inspections")
          .update({
            status: (body["status"] as string) ?? "completed",
            adapter: (body["adapter"] as string) ?? null,
            ats_type: (body["atsType"] as string) ?? null,
            auto_apply_eligible: (body["autoApplyEligible"] as boolean) ?? null,
            captcha_detected: (body["captchaDetected"] as boolean) ?? null,
            login_required: (body["loginRequired"] as boolean) ?? null,
            required_fields: (body["requiredFields"] ?? []) as never,
            mapped_fields: (body["mappedFields"] ?? []) as never,
            unknown_fields: (body["unknownFields"] ?? []) as never,
            reason: (body["reason"] as string) ?? null,
            error_code: (body["errorCode"] as string) ?? null,
            error_message: (body["errorMessage"] as string) ?? null,
            completed_at: new Date().toISOString(),
          })
          .eq("id", params.id);
        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({ ok: true });
      },
    },
  },
});
