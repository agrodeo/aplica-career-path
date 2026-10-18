import { describe, expect, test } from "bun:test";
import { detectJobBoardUrl, jobSourceProviders } from "@/lib/job-sources/registry";

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

  test("detects Workable", () => {
    expect(
      detectJobBoardUrl("https://apply.workable.com/example/jobs/"),
    ).toMatchObject({
      provider: "workable",
      identifier: "example",
      careersUrl: "https://apply.workable.com/example/",
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


describe("Auto Apply capability", () => {
  test("registers a submission adapter for every supported ATS", () => {
    expect(
      Object.fromEntries(
        Object.entries(jobSourceProviders).map(([provider, config]) => [
          provider,
          config.submissionAdapter,
        ]),
      ),
    ).toEqual({
      greenhouse: "greenhouse_public_form",
      lever: "lever_public_form",
      ashby: "ashby_public_form",
      custom: null,
      workday: "workday_public_form",
      smartrecruiters: "smartrecruiters_public_form",
      workable: "workable_public_form",
    });
  });
});
