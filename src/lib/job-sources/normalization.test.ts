import { describe, expect, test } from "bun:test";
import { parseHumanPostedAt } from "@/lib/job-sources/normalization";

describe("job posting freshness parsing", () => {
  const now = new Date("2026-09-19T15:00:00.000Z");

  test("parses Workday today labels", () => {
    expect(parseHumanPostedAt("Posted Today", now)).toBe(now.toISOString());
  });

  test("parses Workday yesterday labels", () => {
    expect(parseHumanPostedAt("Posted Yesterday", now)).toBe(
      "2026-09-18T15:00:00.000Z",
    );
  });

  test("parses relative day counts", () => {
    expect(parseHumanPostedAt("Posted 3 Days Ago", now)).toBe(
      "2026-09-16T15:00:00.000Z",
    );
  });

  test("keeps ISO timestamps", () => {
    expect(parseHumanPostedAt("2026-09-19T12:30:00Z", now)).toBe(
      "2026-09-19T12:30:00.000Z",
    );
  });
});
