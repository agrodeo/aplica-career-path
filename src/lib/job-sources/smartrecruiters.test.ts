import { afterEach, describe, expect, test } from "bun:test";
import { smartRecruitersProvider } from "./smartrecruiters";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function publicBoard(total: number) {
  let detailRequests = 0;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    const detail = url.pathname.match(/\/postings\/(\d+)$/);
    if (detail) {
      detailRequests++;
      return Response.json({
        id: detail[1],
        name: `Nurse ${detail[1]}`,
        location: { country: "ar", city: "Buenos Aires" },
        jobAd: { sections: { jobDescription: { text: "Verified description" } } },
      });
    }
    const offset = Number(url.searchParams.get("offset"));
    const limit = Number(url.searchParams.get("limit"));
    return Response.json({
      totalFound: total,
      content: Array.from({ length: Math.min(limit, total - offset) }, (_, i) => ({
        id: String(offset + i),
        name: `Nurse ${offset + i}`,
        location: { country: "ar", city: "Buenos Aires" },
        function: { label: "Health Care Provider" },
      })),
    });
  }) as typeof fetch;
  return () => detailRequests;
}

describe("large multidisciplinary SmartRecruiters boards", () => {
  test("discovers jobs beyond the previous 2,000 limit without an unbounded detail fanout", async () => {
    const details = publicBoard(2_101);
    const result = await smartRecruitersProvider.fetchJobs("Hospital");
    expect(result.jobs).toHaveLength(2_101);
    expect(result.reportedTotal).toBe(2_101);
    expect(details()).toBe(20);
    expect(result.jobs[0]?.description).toBe("Verified description");
    expect(result.jobs[2_100]).toMatchObject({
      title: "Nurse 2100",
      country: "ar",
      description: "",
      rawData: { detail_loaded: false, function: { label: "Health Care Provider" } },
    });
  });

  test("retains the reported total when the 30,000 discovery cap makes a snapshot partial", async () => {
    publicBoard(32_000);
    const result = await smartRecruitersProvider.fetchJobs("Retail");
    expect(result.jobs).toHaveLength(30_000);
    expect(result.reportedTotal).toBe(32_000);
    expect(result.jobs.length < result.reportedTotal!).toBe(true);
  });
});
