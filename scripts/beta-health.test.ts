import { expect, test } from "bun:test";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
async function check(stale = false, fail = false) {
  const methods: string[] = [];
  const server = createServer((req, res) => {
    methods.push(req.method ?? "");
    res.setHeader("content-type", "application/json");
    const date = new Date(Date.now() - (stale ? 7 : 1) * 3600000).toISOString();
    if (fail) { res.writeHead(400); res.end(JSON.stringify({ code: "FIXTURE_ERROR" })); }
    else res.end(JSON.stringify(req.url?.includes("companies") ? [{ last_scanned_at: date }] : req.url?.includes("adapter_inspections") ? [{ completed_at: date }] : []));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as { port: number };
    const child = spawn(process.execPath, ["scripts/beta-health.ts"], { env: { ...process.env, SUPABASE_URL: `http://127.0.0.1:${address.port}`, SUPABASE_SERVICE_ROLE_KEY: "sb_secret_fixture_1234567890", HEALTH_REPORT_PATH: "" } });
    let output = "";
    child.stdout.on("data", (chunk) => output += chunk);
    child.stderr.on("data", (chunk) => output += chunk);
    const code = await new Promise<number | null>((resolve, reject) => { child.on("close", resolve); child.on("error", reject); });
    return { code, report: JSON.parse(output), methods };
  } finally { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
}
test("health checks stay read-only and accept recent production activity", async () => {
  const result = await check();
  expect(result.code).toBe(0); expect(result.report.healthy).toBe(true);
  expect(result.methods).toEqual(["GET", "GET", "GET"]);
});
test("stale activity and unavailable queries cannot report healthy", async () => {
  const stale = await check(true);
  expect(stale.code).toBe(1); expect(stale.report.errors.length).toBe(2);
  const failed = await check(false, true);
  expect(failed.code).toBe(1); expect(failed.report.healthy).toBe(false);
  expect(failed.report.errors.length).toBe(3);
});
