import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

async function runWorker(target, handle, options = {}) {
  const requests = [];
  const server = createServer(async (request, response) => {
    let text = "";
    for await (const chunk of request) text += chunk;
    requests.push({ path: request.url, body: JSON.parse(text || "{}"), headers: request.headers });
    const result = handle(requests);
    response.writeHead(result.status, { "Content-Type": "application/json" });
    response.end(JSON.stringify(result.body));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  let child;
  try {
    child = spawn(process.execPath, ["dist/index.js"], {
      cwd: fileURLToPath(new URL("../", import.meta.url)),
      env: { ...process.env, SUPABASE_URL: `http://127.0.0.1:${server.address().port}`, SUPABASE_SERVICE_ROLE_KEY: "sb_secret_local_fixture_1234567890",
        WORKER_ID: "target-fixture", WORKER_MODE: "development", DRY_RUN: "true", RUN_ONCE: "true", RUN_TARGET: target, INSPECTION_PROVIDER: "greenhouse", ...options.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    const code = await new Promise((resolve, reject) => {
      const deadline = setTimeout(() => { child.kill(); reject(new Error("Worker fixture timed out")); }, 10000);
      child.on("close", (value) => { clearTimeout(deadline); resolve(value); });
      child.on("error", (error) => { clearTimeout(deadline); reject(error); });
    });
    assert.equal(code, options.expectedExit ?? 0, output);
    return requests;
  } finally {
    if (child && child.exitCode === null) child.kill();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

test("inspections recover from a cache outage without depending on the application queue", async () => {
  const requests = await runWorker("inspections", (calls) => calls.length === 1
    ? { status: 503, body: { code: "PGRST002", message: "Schema cache not ready" } }
    : { status: 200, body: [] });
  assert.equal(requests.length, 2);
  for (const request of requests) {
    assert.equal(request.path, "/rest/v1/rpc/claim_inspection_batch");
    assert.equal(request.body._ats_type, "greenhouse");
    assert.equal(request.body._worker_id, "target-fixture");
    assert.equal(request.headers.authorization, undefined);
    assert.equal(request.headers.apikey, "sb_secret_local_fixture_1234567890");
  }
});
test("application workers do not wait for or claim inspection work", async () => {
  const requests = await runWorker("applications", () => ({ status: 200, body: [] }));
  assert.equal(requests.length, 1);
  assert.equal(requests[0].path, "/rest/v1/rpc/claim_application");
});

test("healthy inspection waves acknowledge each lease before claiming the next bounded wave", async () => {
  const directory = await mkdtemp(join(tmpdir(), "worker-waves-"));
  try {
    const calls = await runWorker("inspections", requests => {
      if (requests.at(-1).path.endsWith("report_inspection_result")) return { status: 200, body: null };
      const wave = requests.filter(call => call.path.endsWith("claim_inspection_batch")).length;
      return { status: 200, body: [{ id: `00000000-0000-4000-8000-${String(wave).padStart(12, "0")}`, url: "https://unsupported.example/job" }] };
    }, { env: { INSPECTION_OUTBOX_DIR: directory, INSPECTION_MAX_BATCHES: "2", INSPECTION_BATCH_SIZE: "1" } });
    assert.deepEqual(calls.map(call => call.path.split("/").at(-1)), ["claim_inspection_batch", "report_inspection_result", "claim_inspection_batch", "report_inspection_result"]);
    assert.equal((await readdir(directory)).filter(name => name.endsWith(".json")).length, 0);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("a worker report outage checkpoints the original result and prevents more work; restart replays before claiming", async () => {
  const directory = await mkdtemp(join(tmpdir(), "worker-outbox-"));
  const firstId = "00000000-0000-4000-8000-000000000001";
  try {
    const failed = await runWorker("inspections", calls => calls.length === 1
      ? { status: 200, body: [
        { id: firstId, url: "https://unsupported.example/job-one" },
        { id: "00000000-0000-4000-8000-000000000002", url: "https://unsupported.example/job-two" },
      ] }
      : { status: 503, body: { code: "PGRST002", message: "Schema cache unavailable" } },
      { expectedExit: 1, env: { INSPECTION_OUTBOX_DIR: directory, INSPECTION_CONCURRENCY: "1" } });
    const reports = failed.filter(call => call.path.endsWith("report_inspection_result"));
    assert.equal(reports.length, 3);
    for (const report of reports) {
      assert.equal(report.body._inspection_id, firstId);
      assert.equal(report.body._payload.status, "completed");
      assert.equal(report.body._payload.errorCode, undefined);
    }
    assert.equal((await readdir(directory)).filter(name => name.endsWith(".json")).length, 1);
    const saved = JSON.parse(await readFile(join(directory, `${firstId}.json`), "utf8"));
    const resumed = await runWorker("inspections", calls => ({ status: 200, body: calls.at(-1).path.endsWith("report_inspection_result") ? null : [] }),
      { env: { INSPECTION_OUTBOX_DIR: directory, WORKER_ID: "restart-fixture" } });
    assert.equal(resumed[0].path, "/rest/v1/rpc/report_inspection_result");
    assert.equal(resumed[0].body._worker_id, saved.workerId);
    assert.equal(resumed[1].path, "/rest/v1/rpc/claim_inspection_batch");
    assert.equal(resumed[1].body._worker_id, "restart-fixture");
    assert.equal((await readdir(directory)).filter(name => name.endsWith(".json")).length, 0);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
