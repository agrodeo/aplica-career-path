import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> }; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (data !== true) throw new Error("Forbidden");
}

/**
 * Queues an adapter inspection for the external worker. Inspection needs a real
 * browser, so the worker performs it; this only records the request.
 */
export const requestInspection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { url: string; mode: "inspect" | "dry_run" }) => {
    let parsed: URL;
    try {
      parsed = new URL(data.url);
    } catch {
      throw new Error("Ingresá una URL válida de la postulación.");
    }
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("La URL debe ser http o https.");
    return { url: parsed.toString(), mode: data.mode === "dry_run" ? ("dry_run" as const) : ("inspect" as const) };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { data: row, error } = await context.supabase
      .from("adapter_inspections")
      .insert({ requested_by: context.userId, url: data.url, mode: data.mode })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const listInspections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { data } = await context.supabase.from("adapter_inspections").select("*").order("created_at", { ascending: false }).limit(15);
    return data ?? [];
  });

/** "What did Aplica send?" — the exact CV, answers and job at submission time. */
export const getApplicationSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { attemptId: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: snapshot } = await context.supabase
      .from("application_snapshots")
      .select("answers, job_snapshot, submitted_at, resume_variant_id")
      .eq("application_attempt_id", data.attemptId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!snapshot) return null;

    const { data: attempt } = await context.supabase
      .from("application_attempts")
      .select("status, adapter, adapter_version, verification_type, verification_value, submitted_at, verified_at, evidence_path")
      .eq("id", data.attemptId)
      .eq("user_id", context.userId)
      .maybeSingle();

    let resumeUrl: string | null = null;
    if (snapshot.resume_variant_id) {
      const { data: variant } = await context.supabase.from("resume_variants").select("pdf_path").eq("id", snapshot.resume_variant_id).maybeSingle();
      if (variant?.pdf_path) {
        const { data: signed } = await context.supabase.storage.from("resumes").createSignedUrl(variant.pdf_path, 600);
        resumeUrl = signed?.signedUrl ?? null;
      }
    }

    let evidenceUrl: string | null = null;
    if (attempt?.evidence_path) {
      const { data: signed } = await context.supabase.storage.from("application-evidence").createSignedUrl(attempt.evidence_path, 600);
      evidenceUrl = signed?.signedUrl ?? null;
    }

    return { snapshot, attempt, resumeUrl, evidenceUrl };
  });
