import { describe, expect, test } from "bun:test";
import { inspectionPriority, selectInspectionCandidates, type InspectionCandidate } from "./discovery-policy";

const now = Date.parse("2026-10-19T00:00:00Z");
function job(id: string, extra: Partial<InspectionCandidate> = {}): InspectionCandidate {
  return { external_job_id: id, application_url: `https://example.test/${id}`, last_verified_at: null, ...extra };
}

describe("discovery priorities", () => {
  test("LATAM and explicitly worldwide remote jobs precede US-only remote jobs", () => {
    const argentina = job("ar", { country: "ar" });
    const global = job("global", { location: "Remote - Worldwide", remote_type: "remote" });
    const us = job("us", { country: "us", location: "Remote US", remote_type: "remote", published_at: "2026-10-18T00:00:00Z" });
    expect(inspectionPriority(argentina, now)).toBe(1050);
    expect(inspectionPriority(global, now)).toBe(650);
    expect(inspectionPriority(us, now)).toBe(300);
  });
  test("regional location works without a country, while missing and future dates are not recent", () => {
    expect(inspectionPriority(job("regional", { location: "América Latina" }), now)).toBe(1050);
    expect(inspectionPriority(job("missing"), now)).toBe(50);
    expect(inspectionPriority(job("future", { published_at: "2026-11-01" }), now)).toBe(50);
  });
  test("all fields of work can qualify and actual publication recency orders within geography", () => {
    const jobs = [job("old", { country: "ar", published_at: "2026-05-01" }), job("unknown", { country: "ar" }), job("new", { country: "ar", published_at: "2026-10-18" })];
    expect(selectInspectionCandidates(jobs, new Set(jobs.map(j => j.external_job_id)), now).map(j => j.external_job_id)).toEqual(["new", "unknown", "old"]);
  });
  test("removed listings cannot reenter the queue and recent inspections are not repeated daily", () => {
    const jobs = [job("removed"), job("recent", { last_verified_at: "2026-10-17" }), job("stale", { last_verified_at: "2026-10-01" }), job("no-url", { application_url: null })];
    expect(selectInspectionCandidates(jobs, new Set(["recent", "stale", "no-url"]), now).map(j => j.external_job_id)).toEqual(["stale"]);
  });
  test("large sources have a bounded inspection intake", () => {
    const jobs = Array.from({ length: 300 }, (_, i) => job(String(i)));
    expect(selectInspectionCandidates(jobs, new Set(jobs.map(j => j.external_job_id)), now)).toHaveLength(200);
  });
});
