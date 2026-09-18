import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { chromium, type Browser } from "playwright";
import { prepareAnswers } from "../application/answers.js";
import { createPublicFormAdapter } from "./public-form.js";
import type { MasterProfile } from "./types.js";

let server: Server;
let baseUrl = "";
let browser: Browser;

const adapter = createPublicFormAdapter({
  id: "test_public_form",
  version: "test",
  atsType: "test",
  hostPatterns: [/^127\.0\.0\.1(?::\d+)?$/],
  formSelector: "form#application-form",
  submitSelectors: ["button[type='submit']"],
});

const baseProfile: MasterProfile = {
  userId: "00000000-0000-0000-0000-000000000001",
  masterProfileVersion: 1,
  identity: {
    firstName: "Sofia",
    lastName: "Fernandez",
    email: "sofia@example.com",
    phone: "+5491100000000",
    city: "Buenos Aires",
    country: "Argentina",
    currentTitle: "Growth Analyst",
    professionalSummary: "Growth Analyst con experiencia en adquisición.",
  },
  experience: [
    {
      id: "00000000-0000-0000-0000-000000000002",
      company: "Example",
      title: "Growth Analyst",
      startDate: "2024-01-01",
      endDate: null,
      isCurrent: true,
      description: "Analiza campañas y adquisición.",
      achievements: [],
    },
  ],
  education: [],
  skills: [{ id: "00000000-0000-0000-0000-000000000003", name: "Growth" }],
  languages: [{ language: "Español", level: "Nativo" }],
  verifiedApplicationAnswers: [],
  links: { linkedin: "https://linkedin.com/in/example", portfolio: "" },
  careerContext: {
    preferredTasks: [],
    avoidTasks: [],
    strengths: [],
    differentiators: [],
    tools: [],
    responsibilities: [],
    results: [],
    proudProject: "",
    challengeStory: "",
    careerGoal: "",
    targetEnvironment: "",
    availability: "",
    travelPreference: "",
  },
  writingPreferences: {
    voice: "balanced",
    emphasis: [],
    deEmphasis: [],
    summaryStyle: "concise",
  },
  facts: [],
};

function html(extra = "") {
  return `<!doctype html>
<html><body>
<form id="application-form">
  <label for="first_name">First Name *</label>
  <input id="first_name" name="first_name" required />

  <label for="last_name">Last Name *</label>
  <input id="last_name" name="last_name" required />

  <label for="email">Email *</label>
  <input id="email" name="email" type="email" required />

  <label for="country">Country *</label>
  <select id="country" name="country" required>
    <option value="">Select</option>
    <option value="AR">Argentina</option>
    <option value="US">United States</option>
  </select>

  <label for="resume">Resume/CV *</label>
  <input id="resume" name="resume" type="file" required />

  <fieldset>
    <legend>Will you now or in the future require sponsorship? *</legend>
    <label><input type="radio" name="sponsorship" value="yes" required /> Yes</label>
    <label><input type="radio" name="sponsorship" value="no" required /> No</label>
  </fieldset>

  ${extra}
  <button type="submit">Submit application</button>
</form>
</body></html>`;
}

function withSponsorship(profile: MasterProfile = baseProfile): MasterProfile {
  return {
    ...profile,
    verifiedApplicationAnswers: [
      ...profile.verifiedApplicationAnswers,
      {
        canonicalKey: "sponsorship",
        answerType: "boolean",
        booleanValue: false,
        textValue: null,
        numericValue: null,
        userConfirmed: true,
      },
    ],
  };
}

before(async () => {
  server = createServer((request, response) => {
    const custom = request.url?.includes("custom");
    const unsupported = request.url?.includes("unsupported");
    const cover = request.url?.includes("cover");
    const checkbox = request.url?.includes("checkbox");

    const extra = custom
      ? '<label for="moon">Favorite moon *</label><select id="moon" required><option value="">Select</option><option value="europa">Europa</option><option value="titan">Titan</option></select>'
      : unsupported
        ? '<label for="start">Exact availability date *</label><input id="start" type="date" required />'
        : cover
          ? '<label for="cover">Cover Letter *</label><input id="cover" type="file" required />'
          : checkbox
            ? '<label><input id="privacy" type="checkbox" required /> I agree to the privacy notice *</label>'
            : "";

    response.writeHead(200, { "content-type": "text/html" });
    response.end(html(extra));
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("test server failed");
  baseUrl = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  await browser?.close();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

test("radio group question maps to sponsorship instead of Yes/No option label", async () => {
  const page = await browser.newPage();
  try {
    const schema = await adapter.inspect(baseUrl, page);
    const sponsorship = schema.fields.find(
      (field) => field.canonicalKey === "sponsorship",
    );
    assert.ok(sponsorship);
    assert.match(sponsorship.label, /sponsorship/i);
    assert.deepEqual(
      sponsorship.options?.map((option) => option.value),
      ["yes", "no"],
    );
  } finally {
    await page.close();
  }
});

test("country is mapped from the profile to the ATS option value", async () => {
  const page = await browser.newPage();
  try {
    const schema = await adapter.inspect(baseUrl, page);
    const profile = withSponsorship();
    const answers = prepareAnswers(schema, profile, {
      id: "job",
      title: "Growth Analyst",
      description: "",
      company: "Example",
      location: "Buenos Aires",
      applicationUrl: baseUrl,
      atsType: "test",
    });
    const country = answers.find((answer) => answer.field.canonicalKey === "country");
    assert.equal(country?.value, "AR");
  } finally {
    await page.close();
  }
});

test("dry run fills verified fields and stops before final submit", async () => {
  const page = await browser.newPage();
  try {
    const schema = await adapter.inspect(baseUrl, page);
    const profile = withSponsorship();
    const job = {
      id: "job",
      title: "Growth Analyst",
      description: "",
      company: "Example",
      location: "Buenos Aires",
      applicationUrl: baseUrl,
      atsType: "test",
    };
    const answers = prepareAnswers(schema, profile, job);

    const dir = await mkdtemp(join(tmpdir(), "aplica-test-"));
    const resumePath = join(dir, "resume.pdf");
    await writeFile(resumePath, Buffer.from("%PDF-1.4\n% test resume"));

    const result = await adapter.submit({
      job,
      profile,
      schema,
      answers,
      resumePath,
      page,
      dryRun: true,
    });

    assert.equal(result.dryRun, true);
    assert.equal(result.submitted, false);
    assert.equal(await page.locator("#first_name").inputValue(), "Sofia");
    assert.equal(await page.locator("#last_name").inputValue(), "Fernandez");
    assert.equal(await page.locator("#email").inputValue(), "sofia@example.com");
    assert.equal(await page.locator("#country").inputValue(), "AR");
    assert.equal(
      await page.locator('input[name="sponsorship"]:checked').inputValue(),
      "no",
    );
    const uploadedFiles = await page.locator("#resume").evaluate(
      (input) => (input as HTMLInputElement).files?.length ?? 0,
    );
    assert.equal(uploadedFiles, 1);
  } finally {
    await page.close();
  }
});

test("missing user sponsorship answer is PROFILE_INCOMPLETE, not a global unsupported job", async () => {
  const page = await browser.newPage();
  try {
    const schema = await adapter.inspect(baseUrl, page);
    const eligibility = await adapter.canSubmit(schema, baseProfile);
    assert.equal(eligibility.eligible, false);
    assert.equal(eligibility.failureCode, "PROFILE_INCOMPLETE");
  } finally {
    await page.close();
  }
});

test("explicit sensitive answer makes the same form eligible", async () => {
  const page = await browser.newPage();
  try {
    const schema = await adapter.inspect(baseUrl, page);
    const eligibility = await adapter.canSubmit(schema, withSponsorship());
    assert.equal(eligibility.eligible, true);
  } finally {
    await page.close();
  }
});

test("custom required select is a user answer gap, not a global adapter blocker", async () => {
  const page = await browser.newPage();
  try {
    const schema = await adapter.inspect(`${baseUrl}/custom`, page);
    assert.equal(schema.unknownRequiredFields.length, 0);

    const missing = await adapter.canSubmit(schema, withSponsorship());
    assert.equal(missing.failureCode, "PROFILE_INCOMPLETE");

    const customField = schema.fields.find((field) => /favorite moon/i.test(field.label));
    assert.ok(customField);

    const profile: MasterProfile = {
      ...withSponsorship(),
      verifiedApplicationAnswers: [
        ...withSponsorship().verifiedApplicationAnswers,
        {
          canonicalKey: customField.answerKey,
          answerType: "text",
          booleanValue: null,
          textValue: "europa",
          numericValue: null,
          userConfirmed: true,
        },
      ],
    };

    const eligible = await adapter.canSubmit(schema, profile);
    assert.equal(eligible.eligible, true);

    const answers = prepareAnswers(schema, profile, {
      id: "job",
      title: "Growth Analyst",
      description: "",
      company: "Example",
      location: "Buenos Aires",
      applicationUrl: baseUrl,
      atsType: "test",
    });
    const customAnswer = answers.find((answer) => answer.field.answerKey === customField.answerKey);
    assert.equal(customAnswer?.value, "europa");
    assert.equal(customAnswer?.source, "verified_answer");
  } finally {
    await page.close();
  }
});

test("custom answers are scoped to the application URL", async () => {
  const first = await browser.newPage();
  const second = await browser.newPage();
  try {
    const schemaA = await adapter.inspect(`${baseUrl}/custom?a=1`, first);
    const schemaB = await adapter.inspect(`${baseUrl}/custom?a=2`, second);
    const fieldA = schemaA.fields.find((field) => /favorite moon/i.test(field.label));
    const fieldB = schemaB.fields.find((field) => /favorite moon/i.test(field.label));
    assert.ok(fieldA);
    assert.ok(fieldB);
    assert.notEqual(fieldA.answerKey, fieldB.answerKey);
  } finally {
    await first.close();
    await second.close();
  }
});

test("required checkbox must be explicitly accepted, not merely answered", async () => {
  const page = await browser.newPage();
  try {
    const schema = await adapter.inspect(`${baseUrl}/checkbox`, page);
    const checkbox = schema.fields.find((field) => field.type === "checkbox");
    assert.ok(checkbox);

    const base = withSponsorship();
    const declined: MasterProfile = {
      ...base,
      verifiedApplicationAnswers: [
        ...base.verifiedApplicationAnswers,
        {
          canonicalKey: checkbox.answerKey,
          answerType: "boolean",
          booleanValue: false,
          textValue: null,
          numericValue: null,
          userConfirmed: true,
        },
      ],
    };
    assert.equal(
      (await adapter.canSubmit(schema, declined)).failureCode,
      "PROFILE_INCOMPLETE",
    );

    const accepted: MasterProfile = {
      ...base,
      verifiedApplicationAnswers: [
        ...base.verifiedApplicationAnswers,
        {
          canonicalKey: checkbox.answerKey,
          answerType: "boolean",
          booleanValue: true,
          textValue: null,
          numericValue: null,
          userConfirmed: true,
        },
      ],
    };
    assert.equal((await adapter.canSubmit(schema, accepted)).eligible, true);
  } finally {
    await page.close();
  }
});

test("truly unsupported required control remains a global adapter blocker", async () => {
  const page = await browser.newPage();
  try {
    const schema = await adapter.inspect(`${baseUrl}/unsupported`, page);
    assert.ok(schema.unknownRequiredFields.includes("Exact availability date *"));
    const eligibility = await adapter.canSubmit(schema, withSponsorship());
    assert.equal(eligibility.failureCode, "UNSUPPORTED_FIELD");
  } finally {
    await page.close();
  }
});

test("required extra file is unsupported until we intentionally generate it", async () => {
  const page = await browser.newPage();
  try {
    const schema = await adapter.inspect(`${baseUrl}/cover`, page);
    const eligibility = await adapter.canSubmit(schema, withSponsorship());
    assert.equal(eligibility.failureCode, "UNSUPPORTED_FIELD");
    assert.ok(
      eligibility.unknownRequiredFields.some((field) => /cover letter/i.test(field)),
    );
  } finally {
    await page.close();
  }
});
