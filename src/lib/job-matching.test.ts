import { describe, expect, test } from "bun:test";
import { extractJobRequirements, scoreStructuredMatch } from "./job-matching";

const baseCandidate = {
  currentTitle: "Growth Manager",
  city: "Buenos Aires",
  country: "Argentina",
  targetRoles: ["Growth Manager", "Growth Lead"],
  targetLocations: ["Buenos Aires", "Remote"],
  remoteAllowed: true,
  hybridAllowed: true,
  onsiteAllowed: false,
  employmentTypes: ["full-time"],
  seniorityLevels: ["manager", "lead"],
  willingToRelocate: false,
  internationalRemote: true,
  minimumSalary: null,
  salaryCurrency: null,
  skills: [
    { name: "Meta Ads", yearsExperience: 2 },
    { name: "Google Ads", yearsExperience: 2 },
    { name: "HubSpot", yearsExperience: 1 },
    { name: "Growth Marketing", yearsExperience: 2 },
  ],
  languages: [
    { language: "Spanish", level: "Native" },
    { language: "English", level: "Advanced" },
  ],
  education: [{ degree: "Actuarial Science", field: "Economics" }],
  experiences: [
    {
      title: "Social Media Manager",
      company: "Example",
      startDate: "2024-01-01",
      endDate: null,
      isCurrent: true,
      description: "Managed paid social, growth experiments and acquisition.",
      achievements: ["Improved engagement and ran Meta Ads campaigns."],
    },
  ],
  tools: ["HubSpot", "Google Analytics"],
  preferredTasks: ["growth", "experimentation", "acquisition"],
  avoidTasks: [],
  workAuthorizationAnswers: [],
};

describe("extractJobRequirements", () => {
  test("extracts years, required skills and languages", () => {
    const req = extractJobRequirements({
      title: "Growth Manager",
      description:
        "Requirements: At least 2 years of experience in growth marketing. Must have Meta Ads and Google Ads experience. English required.",
      location: "Remote",
      country: null,
      remoteType: "remote",
      employmentType: "full-time",
      seniority: "manager",
    });

    expect(req.minimumYearsExperience).toBe(2);
    expect(req.requiredSkills).toContain("meta ads");
    expect(req.requiredSkills).toContain("google ads");
    expect(req.requiredLanguages).toContain("english");
  });
});

describe("scoreStructuredMatch", () => {
  test("keeps a relevant role above threshold", () => {
    const result = scoreStructuredMatch(
      {
        title: "Growth Manager",
        description:
          "We need a Growth Manager. At least 2 years of experience. Must have Meta Ads and Google Ads. English required. You will run acquisition experiments.",
        location: "Remote",
        country: null,
        remoteType: "remote",
        employmentType: "full-time",
        seniority: "manager",
      },
      baseCandidate,
    );

    expect(result.hardRequirementsMet).toBe(true);
    expect(result.matchScore).toBeGreaterThanOrEqual(70);
  });

  test("rejects an explicit language mismatch", () => {
    const result = scoreStructuredMatch(
      {
        title: "Growth Manager",
        description:
          "Requirements: 2+ years of experience. German required. Meta Ads required.",
        location: "Remote",
        country: null,
        remoteType: "remote",
        employmentType: "full-time",
        seniority: "manager",
      },
      baseCandidate,
    );

    expect(result.hardRequirementsMet).toBe(false);
    expect(result.explanation.hardRejects).toContain("language_german");
    expect(result.matchScore).toBeLessThanOrEqual(59);
  });

  test("does not match unrelated engineering roles highly", () => {
    const result = scoreStructuredMatch(
      {
        title: "Senior Backend Engineer",
        description:
          "Must have 5+ years of experience with Python, Kubernetes, PostgreSQL and distributed systems.",
        location: "Remote",
        country: null,
        remoteType: "remote",
        employmentType: "full-time",
        seniority: "senior",
      },
      baseCandidate,
    );

    expect(result.matchScore).toBeLessThan(60);
  });
});
