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
          .select("id, worker_id, status, url")
          .eq("id", params.id)
          .maybeSingle();

        if (!inspection || inspection.status !== "running") {
          return jsonResponse({ error: "inspection_not_running" }, 409);
        }

        const status = String(body["status"] ?? "completed");
        const completedAt = new Date().toISOString();

        const { error } = await db
          .from("adapter_inspections")
          .update({
            status,
            adapter: (body["adapter"] as string) ?? null,
            ats_type: (body["atsType"] as string) ?? null,
            auto_apply_eligible:
              typeof body["autoApplyEligible"] === "boolean"
                ? (body["autoApplyEligible"] as boolean)
                : null,
            captcha_detected:
              typeof body["captchaDetected"] === "boolean"
                ? (body["captchaDetected"] as boolean)
                : null,
            login_required:
              typeof body["loginRequired"] === "boolean"
                ? (body["loginRequired"] as boolean)
                : null,
            required_fields: (body["requiredFields"] ?? []) as never,
            mapped_fields: (body["mappedFields"] ?? []) as never,
            unknown_fields: (body["unknownFields"] ?? []) as never,
            reason: (body["reason"] as string) ?? null,
            error_code: (body["errorCode"] as string) ?? null,
            error_message:
              String(body["errorMessage"] ?? "").slice(0, 1000) || null,
            completed_at: completedAt,
          })
          .eq("id", params.id)
          .eq("worker_id", inspection.worker_id);

        if (error) return jsonResponse({ error: error.message }, 500);

        // Discovery inspections are linked back to jobs by their canonical
        // application URL. Only a completed structural inspection can make a
        // job part of Auto Apply inventory.
        if (status === "completed" && inspection.url) {
          const { data: jobs } = await db
            .from("jobs")
            .select("id")
            .eq("application_url", inspection.url);

          const eligible = body["autoApplyEligible"] === true;
          const adapter = String(body["adapter"] ?? "unsupported");
          const atsType = String(body["atsType"] ?? "unknown");
          const reason =
            typeof body["reason"] === "string" && body["reason"]
              ? body["reason"]
              : eligible
                ? null
                : "STRUCTURAL_INSPECTION_FAILED";

          for (const job of jobs ?? []) {
            const { data: existingSchema } = await db
              .from("application_schemas")
              .select("id")
              .eq("job_id", job.id)
              .maybeSingle();

            const schemaPayload = {
              job_id: job.id,
              adapter,
              schema_version: String(body["adapterVersion"] ?? "1"),
              fields: (body["fields"] ?? []) as never,
              required_fields: (body["requiredFields"] ?? []) as never,
              unknown_required_fields: (body["unknownRequiredFields"] ?? []) as never,
              supports_file_upload: body["supportsFileUpload"] === true,
              supports_auto_submit: body["supportsAutoSubmit"] === true,
              captcha_detected: body["captchaDetected"] === true,
              login_required: body["loginRequired"] === true,
              last_verified_at: completedAt,
              valid: body["valid"] === true,
            };

            let schemaId: string | null = null;
            if (existingSchema) {
              const { error: schemaError } = await db
                .from("application_schemas")
                .update(schemaPayload)
                .eq("id", existingSchema.id);
              if (schemaError) {
                workerLog("inspection_schema_update_failed", {
                  inspection_id: params.id,
                  job_id: job.id,
                });
                continue;
              }
              schemaId = existingSchema.id;
            } else {
              const { data: insertedSchema, error: schemaError } = await db
                .from("application_schemas")
                .insert(schemaPayload)
                .select("id")
                .single();
              if (schemaError || !insertedSchema) {
                workerLog("inspection_schema_insert_failed", {
                  inspection_id: params.id,
                  job_id: job.id,
                });
                continue;
              }
              schemaId = insertedSchema.id;
            }

            await db
              .from("jobs")
              .update({
                application_schema_id: schemaId,
                ats_type: atsType,
                auto_apply_adapter: adapter,
                auto_apply_eligible: eligible,
                submission_mechanism: eligible
                  ? "PUBLIC_APPLICATION_FORM"
                  : "UNSUPPORTED",
                ineligibility_reason: reason,
                last_verified_at: completedAt,
              })
              .eq("id", job.id);
          }

          if (adapter !== "unsupported") {
            await db
              .from("adapter_registry")
              .upsert(
                {
                  adapter,
                  label:
                    adapter === "greenhouse_public_form"
                      ? "Greenhouse Public Form"
                      : adapter,
                  discovery: true,
                  schema_discovery: true,
                  submission: true,
                  verification: true,
                  public_discovery_supported: true,
                  authorized_submission_supported: false,
                  public_form_submission_supported: true,
                  connection_status: "connected",
                  health: eligible ? "healthy" : "degraded",
                  last_error: reason,
                  last_checked_at: completedAt,
                  updated_at: completedAt,
                },
                { onConflict: "adapter" },
              );
          }
        }

        workerLog("inspection_completed", {
          inspection_id: params.id,
          eligible:
            typeof body["autoApplyEligible"] === "boolean"
              ? (body["autoApplyEligible"] as boolean)
              : null,
        });
        return jsonResponse({ ok: true });
      },
    },
  },
});
