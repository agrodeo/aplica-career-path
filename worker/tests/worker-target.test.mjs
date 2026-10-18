import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

async function runWorker(target, handle) {
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
        WORKER_ID: "target-fixture", WORKER_MODE: "development", DRY_RUN: "true", RUN_ONCE: "true", RUN_TARGET: target, INSPECTION_PROVIDER: "greenhouse" },
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
    assert.equal(code, 0, output);
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
