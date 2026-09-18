import { loadConfig } from "../config.js";
import { logger } from "../utils/logger.js";
import type {
  JobRecord,
  MasterProfile,
  PreparedAnswer,
} from "../adapters/types.js";

type Source = {
  id: string;
  kind: string;
  text: string;
};

type RewrittenAnswer = {
  answerKey: string;
  text: string;
  sourceIds: string[];
};

const NARRATIVE_KEYS = new Set([
  "cover_letter",
  "motivation",
  "about_you",
  "challenge_story",
  "proud_achievement",
]);

const writerSchema = {
  type: "object",
  additionalProperties: false,
  required: ["answers"],
  properties: {
    answers: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["answerKey", "text", "sourceIds"],
        properties: {
          answerKey: { type: "string" },
          text: { type: "string", maxLength: 2200 },
          sourceIds: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            maxItems: 20,
          },
        },
      },
    },
  },
} as const;

/**
 * Optional narrative-answer layer.
 *
 * It can improve tone, relevance and structure for open application questions,
 * but every material candidate claim must point to an explicit confirmed
 * source. If either the writer or the factual verifier fails, the deterministic
 * answer prepared from MasterProfile is retained.
 */
export async function improveNarrativeAnswers(
  answers: PreparedAnswer[],
  profile: MasterProfile,
  job: JobRecord,
): Promise<PreparedAnswer[]> {
  const candidates = answers.filter(
    (answer) =>
      answer.source === "generated" &&
      typeof answer.value === "string" &&
      NARRATIVE_KEYS.has(answer.field.canonicalKey ?? ""),
  );
  if (!candidates.length) return answers;

  const config = loadConfig();
  const writerModel =
    config.APPLICATION_LLM_MODEL ?? config.RESUME_LLM_MODEL;
  const verifierModel =
    config.APPLICATION_LLM_VERIFIER_MODEL ??
    config.RESUME_LLM_VERIFIER_MODEL ??
    writerModel;

  if (!config.OPENAI_API_KEY || !writerModel || !verifierModel) {
    return answers;
  }

  const sources = buildSources(profile);
  if (!sources.length) return answers;

  try {
    const rewritten = await rewriteAnswers(
      config.OPENAI_API_KEY,
      writerModel,
      candidates,
      sources,
      profile,
      job,
    );

    const sourceById = new Map(sources.map((source) => [source.id, source]));
    const structurallyValid = rewritten.filter((answer) =>
      validateSourceReferences(answer, sourceById),
    );
    if (!structurallyValid.length) return answers;

    const supported = await verifyAnswers(
      config.OPENAI_API_KEY,
      verifierModel,
      structurallyValid,
      sourceById,
      job,
    );

    const replacementByKey = new Map(
      structurallyValid
        .filter((answer) => supported.has(answer.answerKey))
        .map((answer) => [answer.answerKey, answer.text.trim()]),
    );

    if (!replacementByKey.size) return answers;

    return answers.map((answer) => {
      const key = answer.field.canonicalKey ?? "";
      const replacement = replacementByKey.get(key);
      if (!replacement) return answer;
      return {
        ...answer,
        value: replacement,
        source: "generated",
      };
    });
  } catch (error) {
    logger.warn(
      {
        jobId: job.id,
        err: error instanceof Error ? error.message : String(error),
      },
      "narrative answer LLM unavailable; deterministic answers retained",
    );
    return answers;
  }
}

function buildSources(profile: MasterProfile): Source[] {
  const sources: Source[] = [];
  const add = (id: string, kind: string, text: string | null | undefined) => {
    const clean = text?.trim();
    if (!clean) return;
    sources.push({ id, kind, text: clean.slice(0, 4000) });
  };

  add(
    "identity:current_title",
    "current_title",
    profile.identity.currentTitle,
  );
  add("identity:city", "location", profile.identity.city);
  add("identity:country", "location", profile.identity.country);

  for (const experience of profile.experience) {
    add(
      `experience:${experience.id}:company`,
      "employer",
      experience.company,
    );
    add(
      `experience:${experience.id}:title`,
      "job_title",
      experience.title,
    );
    add(
      `experience:${experience.id}:description`,
      "experience_description",
      experience.description,
    );
    experience.achievements.forEach((achievement, index) =>
      add(
        `experience:${experience.id}:achievement:${index}`,
        "achievement",
        achievement,
      ),
    );
  }

  for (const education of profile.education) {
    add(
      `education:${education.id}:institution`,
      "education_institution",
      education.institution,
    );
    add(
      `education:${education.id}:degree`,
      "education_degree",
      education.degree,
    );
    add(
      `education:${education.id}:field`,
      "education_field",
      education.field,
    );
  }

  for (const skill of profile.skills) {
    add(`skill:${skill.id}`, "skill", skill.name);
  }

  profile.languages.forEach((language, index) =>
    add(
      `language:${index}`,
      "language",
      `${language.language} — ${language.level}`,
    ),
  );

  profile.careerContext.responsibilities.forEach((value, index) =>
    add(
      `context:responsibility:${index}`,
      "responsibility",
      value,
    ),
  );
  profile.careerContext.tools.forEach((value, index) =>
    add(`context:tool:${index}`, "tool", value),
  );
  profile.careerContext.results.forEach((value, index) =>
    add(`context:result:${index}`, "result", value),
  );
  profile.careerContext.preferredTasks.forEach((value, index) =>
    add(
      `context:preferred_task:${index}`,
      "preferred_task",
      value,
    ),
  );
  profile.careerContext.strengths.forEach((value, index) =>
    add(`context:strength:${index}`, "self_reported_strength", value),
  );
  profile.careerContext.differentiators.forEach((value, index) =>
    add(
      `context:differentiator:${index}`,
      "self_reported_differentiator",
      value,
    ),
  );

  add(
    "context:proud_project",
    "proud_project",
    profile.careerContext.proudProject,
  );
  add(
    "context:challenge_story",
    "challenge_story",
    profile.careerContext.challengeStory,
  );
  add(
    "context:career_goal",
    "career_goal",
    profile.careerContext.careerGoal,
  );
  add(
    "context:target_environment",
    "target_environment",
    profile.careerContext.targetEnvironment,
  );

  for (const fact of profile.facts) {
    if (!fact.userConfirmed) continue;
    add(`fact:${fact.id}`, fact.factType, fact.claim);
  }

  return dedupeSources(sources).slice(0, 180);
}

async function rewriteAnswers(
  apiKey: string,
  model: string,
  candidates: PreparedAnswer[],
  sources: Source[],
  profile: MasterProfile,
  job: JobRecord,
): Promise<RewrittenAnswer[]> {
  const requested = candidates.map((answer) => ({
    answerKey: answer.field.canonicalKey,
    question: answer.field.label,
    deterministicDraft: String(answer.value),
  }));

  const instructions = [
    "You improve open-ended job application answers.",
    "Your goal is to make each answer concise, specific, natural and relevant to the target role.",
    "You may improve framing, sentence structure, emphasis and tone.",
    "You must not invent candidate facts.",
    "Every material candidate claim must be supported by one or more sourceIds from candidateSources.",
    "Do not convert a preference, goal, strength or differentiator into a past achievement.",
    "Self-reported strengths may be phrased as self-description, not as externally proven performance.",
    "Do not copy a requirement from the job description and claim the candidate has it unless a candidate source supports it.",
    "Do not introduce a number, metric, employer, credential, tool, skill, responsibility, result or leadership claim that is absent from the cited sources.",
    "You may accurately reference the target company, role and job description without treating those as candidate facts.",
    "Keep each answer under roughly 180 words unless the supplied draft is longer.",
    "Return exactly one answer for each requested answerKey.",
    "Return only the requested JSON.",
  ].join("\n");

  const payload = {
    targetJob: {
      title: job.title,
      company: job.company,
      location: job.location,
      description: job.description.slice(0, 12000),
    },
    writingPreferences: profile.writingPreferences,
    requestedAnswers: requested,
    candidateSources: sources,
  };

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
          content: [
            { type: "input_text", text: JSON.stringify(payload) },
          ],
        },
      ],
      text: {
        verbosity: "low",
        format: {
          type: "json_schema",
          name: "application_narrative_answers",
          strict: true,
          schema: writerSchema,
        },
      },
    }),
    signal: AbortSignal.timeout(45_000),
  });

  if (!response.ok) {
    throw new Error(
      `Narrative writer failed [${response.status}]: ${(
        await response.text().catch(() => "")
      ).slice(0, 300)}`,
    );
  }

  const json = (await response.json()) as {
    output?: Array<{
      content?: Array<{ type?: string; text?: string }>;
    }>;
  };
  const text = json.output
    ?.flatMap((item) => item.content ?? [])
    .find((item) => item.type === "output_text")?.text;
  if (!text) throw new Error("Narrative writer returned no structured output.");

  const parsed = JSON.parse(text) as { answers?: RewrittenAnswer[] };
  const returned = parsed.answers ?? [];
  const expected = new Set<string>(
    requested
      .map((answer) => answer.answerKey)
      .filter(Boolean)
      .map((key) => String(key)),
  );

  return returned.filter(
    (answer) =>
      expected.has(answer.answerKey) &&
      answer.text.trim().length > 0 &&
      answer.sourceIds.length > 0,
  );
}

function validateSourceReferences(
  answer: RewrittenAnswer,
  sourceById: Map<string, Source>,
) {
  if (!answer.sourceIds.length) return false;
  const sources = answer.sourceIds
    .map((id) => sourceById.get(id))
    .filter((source): source is Source => Boolean(source));
  if (sources.length !== answer.sourceIds.length) return false;

  const evidence = sources.map((source) => source.text).join(" ");
  const evidenceNumbers = new Set(numericTokens(evidence));
  return numericTokens(answer.text).every((token) =>
    evidenceNumbers.has(token),
  );
}

async function verifyAnswers(
  apiKey: string,
  model: string,
  answers: RewrittenAnswer[],
  sourceById: Map<string, Source>,
  job: JobRecord,
): Promise<Set<string>> {
  const statements = answers.map((answer) => ({
    id: answer.answerKey,
    text: answer.text,
    evidence: answer.sourceIds
      .map((id) => sourceById.get(id))
      .filter((source): source is Source => Boolean(source))
      .map((source) => ({
        kind: source.kind,
        text: source.text,
      })),
  }));

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

  const instructions = [
    "You are a strict factual verifier for job application answers.",
    "For each answer, supported=true only if every material claim about the candidate is directly supported by its evidence.",
    "The target job context can support statements about the company or role, but never candidate qualifications.",
    "Reject added scope, ownership, leadership, causality, tools, skills, responsibilities, credentials, scale, metrics or outcomes not present in evidence.",
    "A self-reported strength or preference can support subjective wording such as 'I enjoy' or 'I consider one of my strengths', but not an objective achievement claim.",
    "Stylistic paraphrase is allowed only when meaning is preserved.",
    "When uncertain, supported=false.",
    "Return exactly one check per supplied id.",
  ].join("\n");

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
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                targetJob: {
                  title: job.title,
                  company: job.company,
                  location: job.location,
                  description: job.description.slice(0, 8000),
                },
                statements,
              }),
            },
          ],
        },
      ],
      text: {
        verbosity: "low",
        format: {
          type: "json_schema",
          name: "application_answer_entailment",
          strict: true,
          schema,
        },
      },
    }),
    signal: AbortSignal.timeout(45_000),
  });

  if (!response.ok) return new Set();

  const json = (await response.json()) as {
    output?: Array<{
      content?: Array<{ type?: string; text?: string }>;
    }>;
  };
  const text = json.output
    ?.flatMap((item) => item.content ?? [])
    .find((item) => item.type === "output_text")?.text;
  if (!text) return new Set();

  const parsed = JSON.parse(text) as {
    checks?: Array<{ id?: string; supported?: boolean }>;
  };
  const checks = parsed.checks ?? [];
  if (checks.length !== statements.length) return new Set();

  return new Set(
    checks
      .filter((check) => check.id && check.supported === true)
      .map((check) => check.id as string),
  );
}

function dedupeSources(sources: Source[]) {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const key = `${source.kind}|${source.text.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function numericTokens(value: string) {
  return value.match(/\d+(?:[.,]\d+)?%?/g) ?? [];
}
