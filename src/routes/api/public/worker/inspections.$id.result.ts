import { createFileRoute } from "@tanstack/react-router";
import {
  assertWorker,
  jsonResponse,
  workerDb,
  workerLog,
} from "@/lib/worker-api.server";

/** POST /api/public/worker/inspections/:id/result — inspection outcome. */
export const Route = createFileRoute("/api/public/worker/inspections/$id/result")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const auth = assertWorker(request);
        if (auth) return auth;

        const body = (await request.json().catch(() => ({}))) as Record<
          string,
          unknown
        >;
        const db = workerDb();

        const { data: inspection } = await db
          .from("adapter_inspections")
          .select("id, worker_id, status")
          .eq("id", params.id)
          .maybeSingle();

        if (!inspection || inspection.status !== "running") {
          return jsonResponse({ error: "inspection_not_running" }, 409);
        }

        const { error } = await db
          .from("adapter_inspections")
          .update({
            status: (body["status"] as string) ?? "completed",
            adapter: (body["adapter"] as string) ?? null,
            ats_type: (body["atsType"] as string) ?? null,
            auto_apply_eligible:
              (body["autoApplyEligible"] as boolean) ?? null,
            captcha_detected: (body["captchaDetected"] as boolean) ?? null,
            login_required: (body["loginRequired"] as boolean) ?? null,
            required_fields: (body["requiredFields"] ?? []) as never,
            mapped_fields: (body["mappedFields"] ?? []) as never,
            unknown_fields: (body["unknownFields"] ?? []) as never,
            reason: (body["reason"] as string) ?? null,
            error_code: (body["errorCode"] as string) ?? null,
            error_message: String(body["errorMessage"] ?? "").slice(0, 1000) || null,
            completed_at: new Date().toISOString(),
          })
          .eq("id", params.id)
          .eq("worker_id", inspection.worker_id);

        if (error) return jsonResponse({ error: error.message }, 500);
        workerLog("inspection_completed", { inspection_id: params.id });
        return jsonResponse({ ok: true });
      },
    },
  },
});
