import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { after, before, test } from "node:test";
import { chromium, type Browser } from "playwright";
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

before(async () => {
  server = createServer((request, response) => {
    const unknown = request.url?.includes("unknown");
    const cover = request.url?.includes("cover");
    const extra = unknown
      ? '<label for="mystery">Favorite moon *</label><input id="mystery" required />'
      : cover
        ? '<label for="cover">Cover Letter *</label><input id="cover" type="file" required />'
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
    const profile: MasterProfile = {
      ...baseProfile,
      verifiedApplicationAnswers: [
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
    const eligibility = await adapter.canSubmit(schema, profile);
    assert.equal(eligibility.eligible, true);
  } finally {
    await page.close();
  }
});

test("unknown required form field is a global adapter blocker", async () => {
  const page = await browser.newPage();
  try {
    const schema = await adapter.inspect(`${baseUrl}/unknown`, page);
    assert.ok(schema.unknownRequiredFields.includes("Favorite moon *"));
    const eligibility = await adapter.canSubmit(schema, baseProfile);
    assert.equal(eligibility.failureCode, "UNSUPPORTED_FIELD");
  } finally {
    await page.close();
  }
});

test("required extra file is unsupported until we intentionally generate it", async () => {
  const page = await browser.newPage();
  try {
    const schema = await adapter.inspect(`${baseUrl}/cover`, page);
    const profile: MasterProfile = {
      ...baseProfile,
      verifiedApplicationAnswers: [
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
    const eligibility = await adapter.canSubmit(schema, profile);
    assert.equal(eligibility.failureCode, "UNSUPPORTED_FIELD");
    assert.ok(eligibility.unknownRequiredFields.some((field) => /cover letter/i.test(field)));
  } finally {
    await page.close();
  }
});
