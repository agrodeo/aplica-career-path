/** Read-only production checks. Output is aggregate operational data, never applicant data. */
import { createClient } from "@supabase/supabase-js";
import { writeFile } from "node:fs/promises";

const url = process.env["SUPABASE_URL"];
const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const since = new Date(Date.now() - 24 * 3600000).toISOString();
const checks = await Promise.all([
  client.from("companies").select("last_scanned_at").eq("active", true).order("last_scanned_at", { ascending: false, nullsFirst: false }).limit(1).abortSignal(AbortSignal.timeout(20000)),
  client.from("adapter_inspections").select("completed_at").eq("status", "completed").order("created_at", { ascending: false }).limit(1).abortSignal(AbortSignal.timeout(20000)),
  client.from("application_attempts").select("status", { count: "exact" }).gte("queued_at", since).limit(1000).abortSignal(AbortSignal.timeout(20000)),
]);
const [inventory, inspections, attempts] = checks;
const errors = checks.flatMap((check, index) => check.error ? [`${["inventory", "inspections", "applications"][index]} check unavailable: ${check.error.code ?? "request_failed"}`] : []);
const ageHours = (value: string | null | undefined) => value ? Math.max(0, (Date.now() - Date.parse(value)) / 3600000) : null;
const inventoryAgeHours = ageHours(inventory.data?.[0]?.last_scanned_at);
const inspectionAgeHours = ageHours(inspections.data?.[0]?.completed_at);
if (!inventory.error && (inventoryAgeHours == null || inventoryAgeHours > 6)) errors.push("No inventory sync observed in the last six hours.");
if (!inspections.error && (inspectionAgeHours == null || inspectionAgeHours > 6)) errors.push("No completed form inspection observed in the last six hours.");
const statuses: Record<string, number> = {};
for (const row of attempts.data ?? []) statuses[row.status] = (statuses[row.status] ?? 0) + 1;
const report = { observedAt: new Date().toISOString(), healthy: errors.length === 0, inventoryAgeHours, inspectionAgeHours, attempts24h: attempts.count, sampledAttempts: attempts.data?.length ?? 0, statuses, errors };
const json = JSON.stringify(report, null, 2);
console.log(json);
if (process.env["HEALTH_REPORT_PATH"]) await writeFile(process.env["HEALTH_REPORT_PATH"], json);
if (errors.length) process.exitCode = 1;
