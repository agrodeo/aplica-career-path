import assert from "node:assert/strict";
import { test } from "node:test";
import { recoverableDatabaseCall } from "../dist/utils/database-retry.js";

test("an idempotent database operation recovers from a lost response and schema-cache outage", async () => {
  let calls = 0;
  const result = await recoverableDatabaseCall(async () => {
    calls++;
    if (calls === 1) throw new Error("fetch failed");
    if (calls === 2) return { data: null, error: { code: "PGRST002", message: "Schema cache unavailable" }, status: 503 };
    return { data: ["same-lease"], error: null, status: 200 };
  }, "fixture", { delayMs: 0 });
  assert.equal(calls, 3);
  assert.deepEqual(result.data, ["same-lease"]);
});
test("authorization failures are never retried", async () => {
  let calls = 0;
  const result = await recoverableDatabaseCall(async () => {
    calls++;
    return { error: { code: "42501", message: "Permission denied" }, status: 403 };
  }, "fixture", { delayMs: 0 });
  assert.equal(calls, 1);
  assert.equal(result.status, 403);
});
test("an ongoing gateway outage stops after three attempts", async () => {
  let calls = 0;
  const result = await recoverableDatabaseCall(async () => {
    calls++;
    return { error: { message: "Gateway timeout" }, status: 504 };
  }, "fixture", { delayMs: 0 });
  assert.equal(calls, 3);
  assert.equal(result.status, 504);
});
