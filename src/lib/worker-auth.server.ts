import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/**
 * Validates the external worker's service credential. Returns a Response when
 * the request must be rejected, or null when the caller is authorized.
 * The credential lives only in server env — never in the browser bundle.
 */
export function assertWorker(request: Request): Response | null {
  const expected = process.env["WORKER_SERVICE_TOKEN"];
  if (!expected) return jsonResponse({ error: "worker_service_not_configured" }, 503);
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (token.length !== expected.length) return jsonResponse({ error: "unauthorized" }, 401);
  let mismatch = 0;
  for (let i = 0; i < token.length; i += 1) mismatch |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  if (mismatch !== 0) return jsonResponse({ error: "unauthorized" }, 401);
  return null;
}

export async function workerAdmin() {
  return createClient<Database>(process.env["SUPABASE_URL"]!, process.env["SUPABASE_SERVICE_ROLE_KEY"]!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
