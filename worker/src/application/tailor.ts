import { loadConfig } from "../config.js";
import { logger } from "../utils/logger.js";
import type { JobRecord, MasterProfile, ResumeFact } from "../adapters/types.js";

export interface TailoredExperience {
  experienceId: string;
  bullets: Array<{ text: string; sourceFactIds: string[] }>;
}

export interface TailoredResumeCopy {
  summary: string;
  summarySourceFactIds: string[];
  experiences: TailoredExperience[];
  model: string | null;
}

type RawTailored = {
  summary: {
    text: string;
    sourceFactIds: string[];
  };
  experiences: Array<{
    experienceId: string;
    bullets: Array<{
      text: string;
      sourceFactIds: string[];
    }>;
  }>;
};

const JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "experiences"],
  properties: {
    summary: {
      type: "object",
      additionalProperties: false,
      required: ["text", "sourceFactIds"],
      properties: {
        text: { type: "string", maxLength: 700 },
        sourceFactIds: {
          type: "array",
          items: { type: "string" },
          maxItems: 12,
        },
      },
    },
    experiences: {
      type: "array",
      maxItems: 20,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["experienceId", "bullets"],
        properties: {
          experienceId: { type: "string" },
          bullets: {
            type: "array",
            maxItems: 5,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["text", "sourceFactIds"],
              properties: {
                text: { type: "string", maxLength: 500 },
                sourceFactIds: {
                  type: "array",
                  items: { type: "string" },
                  minItems: 1,
                  maxItems: 8,
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

/**
 * Optional LLM copy layer. It may improve wording and emphasis, but it is not
 * allowed to introduce facts. Every generated sentence must cite verified
 * FactLedger IDs, then deterministic validators run before copy is accepted.
 *
 * If the model is unavailable or validation fails, the caller keeps the
 * deterministic resume rather than risking a hallucinated claim.
 */
export async function tailorResumeCopy(
  job: JobRecord,
  profile: MasterProfile,
): Promise<TailoredResumeCopy | null> {
  const config = loadConfig();
  if (!config.OPENAI_API_KEY || !config.RESUME_LLM_MODEL) return null;

  const allowedFacts = profile.facts.filter(
    (fact) => fact.userConfirmed && fact.allowedForResume && fact.claim.trim(),
  );
  if (!allowedFacts.length) return null;

  try {
    const payload = await callModel(
      config.OPENAI_API_KEY,
      config.RESUME_LLM_MODEL,
      job,
      profile,
      allowedFacts,
    );
    const validated = validateTailoring(payload, profile, allowedFacts);
    if (!validated) {
      logger.warn(
        { jobId: job.id, model: config.RESUME_LLM_MODEL },
        "resume LLM output rejected by deterministic fact validator",
      );
      return null;
    }

    const verifierModel =
      config.RESUME_LLM_VERIFIER_MODEL ?? config.RESUME_LLM_MODEL;
    const entailed = await verifySemanticEntailment(
      config.OPENAI_API_KEY,
      verifierModel,
      validated,
      allowedFacts,
    );
    if (!entailed) {
      logger.warn(
        { jobId: job.id, model: verifierModel },
        "resume LLM output rejected by semantic fact verifier",
      );
      return null;
    }

    return {
      ...validated,
      model: config.RESUME_LLM_MODEL,
    };
  } catch (error) {
    logger.warn(
      {
        jobId: job.id,
        model: config.RESUME_LLM_MODEL,
        err: error instanceof Error ? error.message : String(error),
      },
      "resume LLM unavailable; deterministic copy retained",
    );
    return null;
  }
}

async function callModel(
  apiKey: string,
  model: string,
  job: JobRecord,
  profile: MasterProfile,
  facts: ResumeFact[],
): Promise<RawTailored> {
  const factPayload = facts.map((fact) => ({
    id: fact.id,
    type: fact.factType,
    claim: fact.claim,
    sourceRef: fact.sourceRef,
  }));

  const experiencePayload = profile.experience.map((experience) => ({
    id: experience.id,
    company: experience.company,
    title: experience.title,
    startDate: experience.startDate,
    endDate: experience.endDate,
    currentDescription: experience.description,
    currentAchievements: experience.achievements,
  }));

  const instructions = [
    "You rewrite resume copy for a real job application.",
    "You MAY improve wording, clarity, ordering, action verbs, concision and emphasis.",
    "You MUST NOT invent any employer, title, date, credential, skill, tool, responsibility, achievement, number, metric, language, education or result.",
    "Every generated bullet must be fully supported by the cited sourceFactIds.",
    "For an experience bullet, cite only facts whose sourceRef equals that experience id. A global skill is not proof it was used at a specific employer.",
    "The summary may synthesize multiple verified facts, but must cite every fact it relies on.",
    "Do not claim causality, leadership, ownership, scale, seniority or expertise unless a cited fact explicitly supports it.",
    "Do not introduce any number that does not appear verbatim in the cited fact claims.",
    "Do not copy requirements from the job description into the candidate's experience.",
    "Use the requested writing voice only as style, never as permission to embellish facts.",
    "Return only the requested structured JSON.",
  ].join("\n");

  const userInput = JSON.stringify({
    targetJob: {
      title: job.title,
      company: job.company,
      description: job.description.slice(0, 12000),
    },
    writingPreferences: profile.writingPreferences,
    careerContextForSelectionOnly: {
      preferredTasks: profile.careerContext.preferredTasks,
      avoidTasks: profile.careerContext.avoidTasks,
      careerGoal: profile.careerContext.careerGoal,
    },
    experiences: experiencePayload,
    verifiedResumeFacts: factPayload,
  });

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
          content: [{ type: "input_text", text: instructions }],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: userInput }],
        },
      ],
      text: {
        verbosity: "low",
        format: {
          type: "json_schema",
          name: "tailored_resume_copy",
          strict: true,
          schema: JSON_SCHEMA,
        },
      },
    }),
    signal: AbortSignal.timeout(45_000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`LLM request failed [${response.status}]: ${body.slice(0, 300)}`);
  }

  const json = (await response.json()) as {
    output?: Array<{
      type?: string;
      content?: Array<{ type?: string; text?: string }>;
    }>;
  };

  const text = json.output
    ?.flatMap((item) => item.content ?? [])
    .find((item) => item.type === "output_text")?.text;

  if (!text) throw new Error("LLM returned no structured output.");
  return JSON.parse(text) as RawTailored;
}

function validateTailoring(
  raw: RawTailored,
  profile: MasterProfile,
  allowedFacts: ResumeFact[],
): Omit<TailoredResumeCopy, "model"> | null {
  if (!raw || typeof raw !== "object") return null;
  const factById = new Map(allowedFacts.map((fact) => [fact.id, fact]));
  const experienceIds = new Set(profile.experience.map((experience) => experience.id));

  const validateSentence = (text: string, sourceIds: string[]) => {
    if (!text.trim() || !sourceIds.length) return false;
    const sourceFacts = sourceIds
      .map((id) => factById.get(id))
      .filter((fact): fact is ResumeFact => Boolean(fact));
    if (sourceFacts.length !== sourceIds.length) return false;

    const supportedText = sourceFacts.map((fact) => fact.claim).join(" ");
    const outputNumbers = numericTokens(text);
    const supportedNumbers = new Set(numericTokens(supportedText));
    if (outputNumbers.some((token) => !supportedNumbers.has(token))) return false;

    // Hard guard for employers and titles: generated text may only mention
    // known company/title strings if it mentions one explicitly.
    const knownNames = profile.experience.flatMap((experience) => [
      experience.company,
      experience.title,
    ]);
    const suspiciousProperPhrases = quotedOrCapitalizedPhrases(text);
    for (const phrase of suspiciousProperPhrases) {
      if (
        phrase.length > 5 &&
        !knownNames.some((known) =>
          known.toLowerCase().includes(phrase.toLowerCase()),
        ) &&
        !supportedText.toLowerCase().includes(phrase.toLowerCase())
      ) {
        // Do not reject normal sentence-start words; only multi-word phrases.
        if (phrase.includes(" ")) return false;
      }
    }
    return true;
  };

  const summary = raw.summary?.text?.trim() ?? "";
  const summaryIds = raw.summary?.sourceFactIds ?? [];
  if (!summary || !summaryIds.length || !validateSentence(summary, summaryIds)) {
    return null;
  }

  const experiences: TailoredExperience[] = [];
  for (const experience of raw.experiences ?? []) {
    if (!experienceIds.has(experience.experienceId)) return null;
    const bullets: Array<{ text: string; sourceFactIds: string[] }> = [];
    for (const bullet of experience.bullets ?? []) {
      const text = bullet.text.trim();
      const sourceFactIds = bullet.sourceFactIds ?? [];
      if (!validateSentence(text, sourceFactIds)) return null;

      // A globally confirmed skill can support a summary/skills section, but
      // it cannot be turned into "I used X at Employer Y" unless the user tied
      // that fact to this exact experience.
      const bulletFacts = sourceFactIds
        .map((id) => factById.get(id))
        .filter((fact): fact is ResumeFact => Boolean(fact));
      if (
        bulletFacts.some(
          (fact) => fact.sourceRef !== experience.experienceId,
        )
      ) {
        return null;
      }

      bullets.push({ text, sourceFactIds });
    }
    experiences.push({
      experienceId: experience.experienceId,
      bullets: bullets.slice(0, 5),
    });
  }

  return {
    summary,
    summarySourceFactIds: summaryIds,
    experiences,
  };
}

async function verifySemanticEntailment(
  apiKey: string,
  model: string,
  copy: Omit<TailoredResumeCopy, "model">,
  facts: ResumeFact[],
): Promise<boolean> {
  const factById = new Map(facts.map((fact) => [fact.id, fact.claim]));
  const statements: Array<{
    id: string;
    text: string;
    evidence: string[];
  }> = [
    {
      id: "summary",
      text: copy.summary,
      evidence: copy.summarySourceFactIds
        .map((id) => factById.get(id))
        .filter((claim): claim is string => Boolean(claim)),
    },
  ];

  for (const experience of copy.experiences) {
    experience.bullets.forEach((bullet, index) => {
      statements.push({
        id: `${experience.experienceId}:${index}`,
        text: bullet.text,
        evidence: bullet.sourceFactIds
          .map((id) => factById.get(id))
          .filter((claim): claim is string => Boolean(claim)),
      });
    });
  }

  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["checks"],
    properties: {
      checks: {
        type: "array",
        minItems: statements.length,
        maxItems: statements.length,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "supported"],
          properties: {
            id: { type: "string" },
            supported: { type: "boolean" },
          },
        },
      },
    },
  } as const;

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
                "You are a strict factual entailment verifier for resume copy.",
                "For each statement, supported=true only when every material claim is directly entailed by its evidence.",
                "Reject added scope, leadership, ownership, causality, expertise, tools, responsibilities, seniority, scale, metrics, outcomes or skills not explicitly present in the evidence.",
                "Stylistic paraphrase is allowed only when meaning is preserved.",
                "When uncertain, set supported=false.",
                "Return one check for every supplied id and do not omit any.",
              ].join("\n"),
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({ statements }),
            },
          ],
        },
      ],
      text: {
        verbosity: "low",
        format: {
          type: "json_schema",
          name: "resume_fact_entailment",
          strict: true,
          schema,
        },
      },
    }),
    signal: AbortSignal.timeout(45_000),
  });

  if (!response.ok) return false;
  const json = (await response.json()) as {
    output?: Array<{
      content?: Array<{ type?: string; text?: string }>;
    }>;
  };
  const text = json.output
    ?.flatMap((item) => item.content ?? [])
    .find((item) => item.type === "output_text")?.text;
  if (!text) return false;

  const parsed = JSON.parse(text) as {
    checks?: Array<{ id?: string; supported?: boolean }>;
  };
  const checks = parsed.checks ?? [];
  if (checks.length !== statements.length) return false;

  const checkById = new Map(
    checks.map((check) => [check.id ?? "", check.supported === true]),
  );
  return statements.every(
    (statement) => checkById.get(statement.id) === true,
  );
}

function numericTokens(value: string) {
  return value.match(/\b\d+(?:[.,]\d+)?%?\b/g) ?? [];
}

function quotedOrCapitalizedPhrases(value: string) {
  return (
    value.match(
      /(?:["“][^"”]{2,60}["”])|(?:\b[A-ZÁÉÍÓÚÑ][\p{L}0-9&.+-]+(?:\s+[A-ZÁÉÍÓÚÑ][\p{L}0-9&.+-]+)+\b)/gu,
    ) ?? []
  ).map((phrase) => phrase.replace(/^["“]|["”]$/g, ""));
}
