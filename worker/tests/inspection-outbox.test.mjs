import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInspectionOutbox, InspectionLeaseLostError } from "../dist/queue/inspection-outbox.js";
import { runInspectionBatch } from "../dist/queue/inspection-batch.js";

const id = "00000000-0000-4000-8000-000000000001";
const payload = { status: "completed", autoApplyEligible: true, fields: [{ label: "Resume/CV", type: "file" }] };
async function temporary(check) {
  const directory = await mkdtemp(join(tmpdir(), "inspection-outbox-"));
  try { await check(directory); } finally { await rm(directory, { recursive: true, force: true }); }
}

test("a lost report response survives a restart without becoming a form failure", async () => temporary(async directory => {
  let committed;
  const first = createInspectionOutbox(directory, "original-worker", async (reportId, body, workerId) => {
    committed = { reportId, body, workerId };
    throw new Error("network response lost after database commit");
  });
  await assert.rejects(first.report(id, payload), /response lost/);
  const saved = JSON.parse(await readFile(join(directory, `${id}.json`), "utf8"));
  assert.deepEqual(saved.payload, payload);
  assert.equal(saved.payload.errorCode, undefined);
  const restarted = createInspectionOutbox(directory, "new-worker", async (reportId, body, workerId) => {
    assert.deepEqual({ reportId, body, workerId }, committed);
  });
  assert.equal(await restarted.replay(), 1);
  assert.deepEqual((await readdir(directory)).filter(file => file.endsWith(".json")), []);
  assert.equal(await restarted.replay(), 0);
}));

test("replay retains failed deliveries and discards only an explicitly lost lease", async () => temporary(async directory => {
  const offline = createInspectionOutbox(directory, "old-worker", async () => { throw new Error("503 unavailable"); });
  await assert.rejects(offline.report(id, payload));
  await assert.rejects(offline.replay(), /503/);
  assert.ok((await readdir(directory)).includes(`${id}.json`));
  const stale = createInspectionOutbox(directory, "new-worker", async () => { throw new InspectionLeaseLostError("new lease owns the row"); });
  assert.equal(await stale.replay(), 1);
  assert.ok(!(await readdir(directory)).includes(`${id}.json`));
}));

test("expired checkpoints never change current job eligibility", async () => temporary(async directory => {
  await writeFile(join(directory, `${id}.json`), JSON.stringify({ version: 1, inspectionId: id, workerId: "old-worker", createdAt: "2020-01-01T00:00:00.000Z", payload }));
  let calls = 0;
  assert.equal(await createInspectionOutbox(directory, "new-worker", async () => { calls++; }).replay(), 1);
  assert.equal(calls, 0);
}));

test("batch failure stops new work and waits for all in-flight work before returning", async () => {
  const started = [];
  let secondFinished = false;
  await assert.rejects(runInspectionBatch([1, 2, 3, 4], 2, async item => {
    started.push(item);
    if (item === 1) throw new Error("persistence unavailable");
    await new Promise(resolve => setTimeout(resolve, 30));
    secondFinished = true;
  }), /persistence unavailable/);
  assert.deepEqual(started, [1, 2]);
  assert.equal(secondFinished, true);
});

test("healthy bounded batches process every item exactly once", async () => {
  const seen = [];
  assert.equal(await runInspectionBatch([1, 2, 3], 2, async item => { seen.push(item); }), 3);
  assert.deepEqual(seen.sort(), [1, 2, 3]);
});
