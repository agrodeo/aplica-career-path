import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CvEvidence = {
  text: string;
  confidence: number;
};

export type StructuredCvExperience = {
  company: string;
  title: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  location: string;
  description: string;
  achievements: string[];
  evidence: {
    company: CvEvidence;
    title: CvEvidence;
    dates: CvEvidence;
    description: CvEvidence;
  };
  confidence: number;
};

export type StructuredCvExtraction = {
  identity: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    city: string;
    country: string;
  };
  experiences: StructuredCvExperience[];
  education: Array<{
    institution: string;
    degree: string;
    field: string;
    dateRange: string;
    evidence: string;
    confidence: number;
  }>;
  skills: Array<{
    name: string;
    evidence: string;
    confidence: number;
  }>;
  languages: Array<{
    language: string;
    level: string;
    evidence: string;
    confidence: number;
  }>;
  extractionConfidence: number;
};

const schema = {
  type: "object",
  additionalProperties: false,
  required: [
    "identity",
    "experiences",
    "education",
    "skills",
    "languages",
    "extractionConfidence",
  ],
  properties: {
    identity: {
      type: "object",
      additionalProperties: false,
      required: [
        "firstName",
        "lastName",
        "email",
        "phone",
        "city",
        "country",
      ],
      properties: {
        firstName: { type: "string" },
        lastName: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        city: { type: "string" },
        country: { type: "string" },
      },
    },
    experiences: {
      type: "array",
      maxItems: 30,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "company",
          "title",
          "startDate",
          "endDate",
          "isCurrent",
          "location",
          "description",
          "achievements",
          "evidence",
          "confidence",
        ],
        properties: {
          company: { type: "string" },
          title: { type: "string" },
          startDate: { type: "string" },
          endDate: { type: "string" },
          isCurrent: { type: "boolean" },
          location: { type: "string" },
          description: { type: "string" },
          achievements: {
            type: "array",
            maxItems: 20,
            items: { type: "string" },
          },
          evidence: {
            type: "object",
            additionalProperties: false,
            required: ["company", "title", "dates", "description"],
            properties: {
              company: {
                type: "object",
                additionalProperties: false,
                required: ["text", "confidence"],
                properties: {
                  text: { type: "string" },
                  confidence: { type: "number" },
                },
              },
              title: {
                type: "object",
                additionalProperties: false,
                required: ["text", "confidence"],
                properties: {
                  text: { type: "string" },
                  confidence: { type: "number" },
                },
              },
              dates: {
                type: "object",
                additionalProperties: false,
                required: ["text", "confidence"],
                properties: {
                  text: { type: "string" },
                  confidence: { type: "number" },
                },
              },
              description: {
                type: "object",
                additionalProperties: false,
                required: ["text", "confidence"],
                properties: {
                  text: { type: "string" },
                  confidence: { type: "number" },
                },
              },
            },
          },
          confidence: { type: "number" },
        },
      },
    },
    education: {
      type: "array",
      maxItems: 20,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "institution",
          "degree",
          "field",
          "dateRange",
          "evidence",
          "confidence",
        ],
        properties: {
          institution: { type: "string" },
          degree: { type: "string" },
          field: { type: "string" },
          dateRange: { type: "string" },
          evidence: { type: "string" },
          confidence: { type: "number" },
        },
      },
    },
    skills: {
      type: "array",
      maxItems: 100,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "evidence", "confidence"],
        properties: {
          name: { type: "string" },
          evidence: { type: "string" },
          confidence: { type: "number" },
        },
      },
    },
    languages: {
      type: "array",
      maxItems: 30,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["language", "level", "evidence", "confidence"],
        properties: {
          language: { type: "string" },
          level: { type: "string" },
          evidence: { type: "string" },
          confidence: { type: "number" },
        },
      },
    },
    extractionConfidence: { type: "number" },
  },
} as const;

export const extractStructuredCv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { text: string }) => {
    const text = data.text.replace(/\0/g, "").trim();
    if (text.length < 40) throw new Error("El CV no contiene suficiente texto.");
    if (text.length > 100_000) {
      throw new Error("El CV es demasiado largo para procesarlo.");
    }
    return { text };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env["OPENAI_API_KEY"];
    const model =
      process.env["CV_EXTRACTION_MODEL"] ??
      process.env["APPLICATION_LLM_MODEL"] ??
      process.env["RESUME_LLM_MODEL"];

    if (!apiKey || !model) {
      return {
        available: false as const,
        extraction: null,
        reason: "structured_extractor_not_configured",
      };
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        store: false,
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: [
                  "You extract structured facts from resumes/CVs.",
                  "Extraction only: do not improve, rewrite, infer, summarize or invent candidate information.",
                  "Never treat section headings such as Work Experience, Experience, Education, Skills, Profile or Summary as a person's name, employer or job title.",
                  "Return every distinct work experience separately and preserve resume order.",
                  "company and title must be explicitly supported by nearby resume text. If either is unclear, use an empty string rather than guessing.",
                  "Dates may be normalized to YYYY-MM when the month/year are explicit. If only a year is explicit use YYYY. If unclear use an empty string.",
                  "Use isCurrent=true only when the resume explicitly says Present, Current, Actualidad, Presente, Hoje or equivalent.",
                  "description and achievements must preserve the factual meaning of the resume. Prefer verbatim text; do not add responsibilities.",
                  "For every extracted work experience provide short verbatim evidence strings copied from the resume for company, title, dates and description.",
                  "confidence is 0 to 1 and reflects extraction certainty, not how impressive the candidate is.",
                  "Skills must be explicit in the resume text. Do not infer skills from job titles or employers.",
                  "Languages must be explicit. Do not infer native language from country.",
                  "Return only the requested structured JSON.",
                ].join("\n"),
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `RESUME TEXT\n---\n${data.text}\n---\nEND RESUME`,
              },
            ],
          },
        ],
        text: {
          verbosity: "low",
          format: {
            type: "json_schema",
            name: "structured_cv_extraction",
            strict: true,
            schema,
          },
        },
      }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!response.ok) {
      return {
        available: false as const,
        extraction: null,
        reason: `extractor_http_${response.status}`,
      };
    }

    const json = (await response.json()) as {
      output?: Array<{
        content?: Array<{ type?: string; text?: string }>;
      }>;
    };
    const outputText = json.output
      ?.flatMap((item) => item.content ?? [])
      .find((item) => item.type === "output_text")?.text;

    if (!outputText) {
      return {
        available: false as const,
        extraction: null,
        reason: "extractor_empty_output",
      };
    }

    let parsed: StructuredCvExtraction;
    try {
      parsed = JSON.parse(outputText) as StructuredCvExtraction;
    } catch {
      return {
        available: false as const,
        extraction: null,
        reason: "extractor_invalid_json",
      };
    }

    const extraction = validateAgainstSource(parsed, data.text);
    return {
      available: true as const,
      extraction,
      reason: null,
    };
  });

function validateAgainstSource(
  extraction: StructuredCvExtraction,
  rawText: string,
): StructuredCvExtraction {
  const source = normalize(rawText);

  const experiences = (extraction.experiences ?? [])
    .map((experience) => {
      const companySupported =
        Boolean(experience.company.trim()) &&
        evidenceExists(source, experience.evidence?.company?.text);
      const titleSupported =
        Boolean(experience.title.trim()) &&
        evidenceExists(source, experience.evidence?.title?.text);

      if (!companySupported || !titleSupported) return null;

      const dateSupported =
        !experience.evidence?.dates?.text?.trim() ||
        evidenceExists(source, experience.evidence.dates.text);
      const descriptionSupported =
        !experience.evidence?.description?.text?.trim() ||
        evidenceExists(source, experience.evidence.description.text);

      const achievements = (experience.achievements ?? [])
        .filter((achievement) => {
          const normalizedAchievement = normalize(achievement);
          if (!normalizedAchievement) return false;
          // Extraction should normally be verbatim. For bullets split by PDF
          // layout, require a meaningful phrase overlap instead of exact bytes.
          return (
            source.includes(normalizedAchievement) ||
            overlapRatio(normalizedAchievement, source) >= 0.72
          );
        })
        .slice(0, 20);

      return {
        ...experience,
        startDate: dateSupported ? cleanDate(experience.startDate) : "",
        endDate: dateSupported ? cleanDate(experience.endDate) : "",
        isCurrent: dateSupported ? Boolean(experience.isCurrent) : false,
        description: descriptionSupported ? experience.description.trim() : "",
        achievements,
        confidence: clamp01(
          Math.min(
            Number(experience.confidence ?? 0),
            Number(experience.evidence.company.confidence ?? 0),
            Number(experience.evidence.title.confidence ?? 0),
          ),
        ),
      };
    })
    .filter((experience): experience is StructuredCvExperience =>
      Boolean(experience),
    );

  const education = (extraction.education ?? []).filter(
    (item) =>
      item.institution.trim() &&
      evidenceExists(source, item.evidence),
  );

  const skills = (extraction.skills ?? []).filter(
    (item) =>
      item.name.trim() &&
      evidenceExists(source, item.evidence),
  );

  const languages = (extraction.languages ?? []).filter(
    (item) =>
      item.language.trim() &&
      evidenceExists(source, item.evidence),
  );

  return {
    ...extraction,
    identity: sanitizeIdentity(extraction.identity, source),
    experiences,
    education,
    skills,
    languages,
    extractionConfidence: clamp01(Number(extraction.extractionConfidence ?? 0)),
  };
}

function sanitizeIdentity(
  identity: StructuredCvExtraction["identity"],
  source: string,
) {
  const fullName = normalize(
    [identity.firstName, identity.lastName].filter(Boolean).join(" "),
  );
  const nameSupported =
    Boolean(fullName) &&
    source.includes(fullName) &&
    !/^(work|professional|employment|career)?\s*experience$/i.test(fullName);

  return {
    firstName: nameSupported ? identity.firstName.trim() : "",
    lastName: nameSupported ? identity.lastName.trim() : "",
    email:
      identity.email.trim() && source.includes(normalize(identity.email))
        ? identity.email.trim()
        : "",
    phone:
      identity.phone.trim() &&
      digits(source).includes(digits(identity.phone))
        ? identity.phone.trim()
        : "",
    city:
      identity.city.trim() && source.includes(normalize(identity.city))
        ? identity.city.trim()
        : "",
    country:
      identity.country.trim() && source.includes(normalize(identity.country))
        ? identity.country.trim()
        : "",
  };
}

function evidenceExists(source: string, evidence?: string | null) {
  const normalizedEvidence = normalize(evidence ?? "");
  if (!normalizedEvidence) return false;
  return (
    source.includes(normalizedEvidence) ||
    overlapRatio(normalizedEvidence, source) >= 0.8
  );
}

function overlapRatio(needle: string, haystack: string) {
  const tokens = needle
    .split(/\s+/)
    .filter((token) => token.length >= 2);
  if (!tokens.length) return 0;
  const haystackTokens = new Set(haystack.split(/\s+/));
  const matched = tokens.filter((token) => haystackTokens.has(token)).length;
  return matched / tokens.length;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[•·|]/g, " ")
    .replace(/[^\p{L}\p{N}@+%./-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function digits(value: string) {
  return value.replace(/\D/g, "");
}

function cleanDate(value: string) {
  return value.trim().slice(0, 20);
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
