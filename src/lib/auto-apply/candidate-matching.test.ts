import { describe, expect, test } from "bun:test";
import { checkMatchConstraints, locationMatchesTarget, similarity } from "./candidate-matching";

const pref = { target_locations: ["Argentina"], remote_allowed: true, hybrid_allowed: false, onsite_allowed: true, employment_types: ["full_time"], seniority_levels: ["junior"] };
const job = { title: "Junior Software Engineer", location: "Argentina", country: "ar", remote_type: "remote", employment_type: "full-time", seniority: "junior" };
const passes = (overrides: Partial<typeof job> = {}, preferences = pref) => Object.values(checkMatchConstraints({ ...job, ...overrides }, preferences)).every(Boolean);
describe("candidate constraints used by the live matching flow", () => {
  test("normalizes contract spelling while respecting explicit seniority and mode", () => {
    expect(passes()).toBe(true);
    expect(passes({ employment_type: "contract" })).toBe(false);
    expect(passes({ seniority: "senior" })).toBe(false);
    expect(passes({ remote_type: "Híbrido" })).toBe(false);
    expect(passes({ remote_type: "unknown" })).toBe(false);
  });
  test("remote US-only roles cannot match an Argentine candidate, even with relocation", () => {
    expect(passes({ location: "United States - Remote", country: "us" })).toBe(false);
    expect(passes({ location: "United States - Remote", country: "us" }, { ...pref, willing_to_relocate: true } as typeof pref)).toBe(false);
  });
  test("accepts LATAM and explicitly worldwide roles, and does not guess bare Remote", () => {
    expect(passes({ location: "LATAM", country: "" })).toBe(true);
    expect(passes({ location: "Worldwide", country: "" })).toBe(true);
    expect(passes({ location: "Remote", country: "" })).toBe(false);
  });
  test("explicit residence requirements in the description still apply", () => {
    const checks = checkMatchConstraints({ ...job, location: "Worldwide", country: null, description: "Applicants must be based in United States. We are global." }, pref);
    expect(checks.locationRequirementMet).toBe(false);
    expect(checkMatchConstraints({ ...job, description: "You must be located in Argentina." }, pref).locationRequirementMet).toBe(true);
  });
  test("international remote preference never makes an overseas office local", () => {
    expect(checkMatchConstraints({ ...job, location: "Berlin", country: "de", remote_type: "onsite" }, { ...pref, international_remote: true } as typeof pref).locationRequirementMet).toBe(false);
  });
  test("matches country aliases and avoids substring geography errors", () => {
    expect(locationMatchesTarget("Paris", "fr", "AR")).toBe(false);
    expect(locationMatchesTarget("Córdoba", "ar", "Buenos Aires")).toBe(false);
    expect(locationMatchesTarget("London", "gb", "United Kingdom")).toBe(true);
    expect(locationMatchesTarget("São Paulo", "BR", "Brasil")).toBe(true);
    expect(locationMatchesTarget("Buenos Aires", "AR", "Argentina")).toBe(true);
  });
  test("exclusions and title relevance remain explicit", () => {
    expect(checkMatchConstraints({ ...job, companies: { name: "Excluded Inc" } }, { ...pref, excluded_companies: ["Excluded Inc"] }).companyAllowed).toBe(false);
    expect(similarity("Software Engineer", "Junior Software Engineer")).toBeGreaterThan(70);
    expect(similarity("Nurse", "Software Engineer")).toBe(0);
  });
});
