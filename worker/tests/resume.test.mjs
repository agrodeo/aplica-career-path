import assert from "node:assert/strict";
import { test } from "node:test";
import { buildStructuredResume, renderAtsHtml, validateAgainstProfile } from "../dist/application/resume.js";
import { profile, job } from "./fixtures.mjs";
const career = { ...profile,
  identity: { ...profile.identity, professionalSummary: "Software engineer focused on TypeScript." },
  experience: [
    { id: "growth", company: "A & B", title: "Marketing", startDate: "2020-01-01", endDate: "2021-01-01", isCurrent: false, description: "Launched campaigns for local companies.", achievements: ["Increased views by 20%."] },
    { id: "engineering", company: "Example", title: "Engineer", startDate: "2021-02-01", endDate: null, isCurrent: true, description: "Built software for a support team.", achievements: ["Reduced response time by 10%."] },
  ],
  skills: [{ id: "ts", name: "TypeScript" }, { id: "ads", name: "Advertising" }],
  education: [{ id: "edu", institution: "University", degree: "Engineering", field: "Software" }],
  languages: [{ language: "English", level: "Intermediate" }],
};
test("job-specific CV reorders relevant facts and escapes employer HTML", () => {
  const draft = buildStructuredResume({ ...job, description: "TypeScript engineer" }, career);
  assert.equal(draft.experience[0].experienceId, "engineering");
  assert.deepEqual(draft.skills, ["TypeScript"]);
  assert.equal(validateAgainstProfile(draft, career).passed, true);
  assert.match(renderAtsHtml(draft, career), /A &amp; B/);
});
test("CV validation rejects metrics borrowed from another employer and altered education/language", () => {
  const draft = buildStructuredResume(job, career);
  draft.experience.find((e) => e.experienceId === "engineering").bullets.push("Increased views by 20%.");
  draft.education[0].degree = "PhD";
  draft.languages = [{ language: "English", level: "Native" }];
  draft.professionalSummary = "Award winning executive.";
  const validation = validateAgainstProfile(draft, career);
  assert.equal(validation.passed, false);
  assert.equal(validation.issues.length, 4);
});
