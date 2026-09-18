import { describe, expect, test } from "bun:test";
import {
  validateStructuredCvAgainstSource,
  type StructuredCvExtraction,
} from "./cv-extract.functions";

function baseExtraction(): StructuredCvExtraction {
  return {
    identity: {
      firstName: "Fausto",
      lastName: "Sicilia",
      email: "fausto@example.com",
      phone: "",
      city: "Buenos Aires",
      country: "Argentina",
    },
    experiences: [],
    education: [],
    skills: [],
    languages: [],
    extractionConfidence: 0.95,
  };
}

describe("structured CV evidence validation", () => {
  test("keeps multiple separately evidenced experiences", () => {
    const raw = `
Fausto Sicilia
fausto@example.com
Buenos Aires, Argentina

WORK EXPERIENCE
Forkast
Social Media Manager
Nov 2025 - Mar 2026
Managed social media channels and analyzed performance.
Increased impressions from 14.4K to 76.5K.

Agrodeo
Founder
Mar 2026 - Present
Built cattle management software.
`;

    const extraction = baseExtraction();
    extraction.experiences = [
      {
        company: "Forkast",
        title: "Social Media Manager",
        startDate: "2025-11",
        endDate: "2026-03",
        isCurrent: false,
        location: "Buenos Aires",
        description: "Managed social media channels and analyzed performance.",
        achievements: ["Increased impressions from 14.4K to 76.5K."],
        evidence: {
          company: { text: "Forkast", confidence: 1 },
          title: { text: "Social Media Manager", confidence: 1 },
          dates: { text: "Nov 2025 - Mar 2026", confidence: 1 },
          description: {
            text: "Managed social media channels and analyzed performance.",
            confidence: 1,
          },
        },
        confidence: 0.98,
      },
      {
        company: "Agrodeo",
        title: "Founder",
        startDate: "2026-03",
        endDate: "",
        isCurrent: true,
        location: "",
        description: "Built cattle management software.",
        achievements: [],
        evidence: {
          company: { text: "Agrodeo", confidence: 1 },
          title: { text: "Founder", confidence: 1 },
          dates: { text: "Mar 2026 - Present", confidence: 1 },
          description: {
            text: "Built cattle management software.",
            confidence: 1,
          },
        },
        confidence: 0.99,
      },
    ];

    const validated = validateStructuredCvAgainstSource(extraction, raw);
    expect(validated.experiences).toHaveLength(2);
    expect(validated.experiences[0]?.company).toBe("Forkast");
    expect(validated.experiences[1]?.company).toBe("Agrodeo");
    expect(validated.experiences[1]?.isCurrent).toBe(true);
  });

  test("drops an invented employer or title even if the model is confident", () => {
    const raw = `
Fausto Sicilia
WORK EXPERIENCE
Forkast
Social Media Manager
Nov 2025 - Mar 2026
`;

    const extraction = baseExtraction();
    extraction.experiences = [
      {
        company: "Google",
        title: "Growth Director",
        startDate: "2025-11",
        endDate: "2026-03",
        isCurrent: false,
        location: "",
        description: "",
        achievements: [],
        evidence: {
          company: { text: "Google", confidence: 0.99 },
          title: { text: "Growth Director", confidence: 0.99 },
          dates: { text: "Nov 2025 - Mar 2026", confidence: 0.99 },
          description: { text: "", confidence: 0 },
        },
        confidence: 0.99,
      },
    ];

    const validated = validateStructuredCvAgainstSource(extraction, raw);
    expect(validated.experiences).toHaveLength(0);
  });

  test("rejects unsupported generated descriptions", () => {
    const raw = `
Forkast
Social Media Manager
Nov 2025 - Mar 2026
`;

    const extraction = baseExtraction();
    extraction.experiences = [
      {
        company: "Forkast",
        title: "Social Media Manager",
        startDate: "2025-11",
        endDate: "2026-03",
        isCurrent: false,
        location: "",
        description: "Led a global team of 20 people.",
        achievements: [],
        evidence: {
          company: { text: "Forkast", confidence: 1 },
          title: { text: "Social Media Manager", confidence: 1 },
          dates: { text: "Nov 2025 - Mar 2026", confidence: 1 },
          description: {
            text: "Led a global team of 20 people.",
            confidence: 1,
          },
        },
        confidence: 0.9,
      },
    ];

    const validated = validateStructuredCvAgainstSource(extraction, raw);
    expect(validated.experiences[0]?.description).toBe("");
  });
});
