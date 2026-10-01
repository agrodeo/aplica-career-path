import { jsonResponse } from "./worker-auth.server";

/**
 * Validates an external cron caller against CRON_API_TOKEN, a secret whose
 * value the user controls (unlike the managed LOVABLE_CRON_SECRET, which is
 * never revealed). Returns a Response when the request must be rejected, or
 * null when the caller is authorized. Server-only — never shipped to the browser.
 */
export function assertCronCaller(request: Request): Response | null {
  const expected = process.env["CRON_API_TOKEN"];
  if (!expected) return jsonResponse({ error: "cron_token_not_configured" }, 503);
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (token.length !== expected.length) return jsonResponse({ error: "unauthorized" }, 401);
  let mismatch = 0;
  for (let i = 0; i < token.length; i += 1) mismatch |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  if (mismatch !== 0) return jsonResponse({ error: "unauthorized" }, 401);
  return null;
}
