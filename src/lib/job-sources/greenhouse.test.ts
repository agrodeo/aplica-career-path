import { afterEach, expect, test } from "bun:test";
import { greenhouseProvider } from "./greenhouse";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test("captures Greenhouse first publication without treating later edits as new postings", async () => {
  globalThis.fetch = (async () => Response.json({ jobs: [
    { id: 1, title: "Nurse", location: { name: "Argentina" }, first_published: "2026-10-16T10:00:00-03:00", updated_at: "2026-10-18T12:00:00Z" },
    { id: 2, title: "Accountant", updated_at: "2026-10-18T12:00:00Z" },
    { id: 3, title: "Warehouse assistant", first_published: "invalid", updated_at: "2026-10-18T12:00:00Z" },
  ] })) as typeof fetch;
  const { jobs } = await greenhouseProvider.fetchJobs("fixture");
  expect(jobs[0]?.publishedAt).toBe("2026-10-16T13:00:00.000Z");
  expect(jobs[0]?.rawData.first_published).toBe("2026-10-16T10:00:00-03:00");
  expect(jobs[1]?.publishedAt).toBeNull();
  expect(jobs[2]?.publishedAt).toBeNull();
});
