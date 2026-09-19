import { describe, expect, test } from "bun:test";
import { detectJobBoardUrl } from "@/lib/job-sources/registry";

describe("job board URL detection", () => {
  test("detects Greenhouse", () => {
    expect(
      detectJobBoardUrl("https://job-boards.greenhouse.io/example/jobs/123"),
    ).toMatchObject({
      provider: "greenhouse",
      identifier: "example",
    });
  });

  test("detects Lever", () => {
    expect(
      detectJobBoardUrl("https://jobs.lever.co/example/abc"),
    ).toMatchObject({
      provider: "lever",
      identifier: "example",
    });
  });

  test("detects Ashby", () => {
    expect(
      detectJobBoardUrl("https://jobs.ashbyhq.com/example/abc"),
    ).toMatchObject({
      provider: "ashby",
      identifier: "example",
    });
  });

  test("detects SmartRecruiters", () => {
    expect(
      detectJobBoardUrl("https://jobs.smartrecruiters.com/ExampleCorp"),
    ).toMatchObject({
      provider: "smartrecruiters",
      identifier: "ExampleCorp",
    });
  });

  test("normalizes Workday job URLs back to the board", () => {
    const input =
      "https://example.wd5.myworkdayjobs.com/en-US/External/job/Buenos-Aires/Role_JR123";
    const board =
      "https://example.wd5.myworkdayjobs.com/en-US/External";
    expect(detectJobBoardUrl(input)).toMatchObject({
      provider: "workday",
      identifier: board,
      companyName: "Example",
      careersUrl: board,
    });
  });

  test("rejects unsupported hosts", () => {
    expect(() =>
      detectJobBoardUrl("https://www.linkedin.com/jobs/view/123"),
    ).toThrow(/no soportada/i);
  });
});
