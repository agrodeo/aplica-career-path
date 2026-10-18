import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { chromium } from "playwright";
import { createPublicFormAdapter } from "../dist/adapters/public-form.js";
import { prepareAnswers } from "../dist/application/answers.js";
import { canonicalKeyFor } from "../dist/adapters/field-map.js";
import { profile, job } from "./fixtures.mjs";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const adapter = createPublicFormAdapter({
  id: "fixture", version: "test", atsType: "fixture", hostPatterns: [/example\.com/],
  formSelector: "form", submitSelectors: ['button[type="submit"]'],
  activateSelectors: ['button[data-open-application]'],
  cookieDeclineSelectors: ["button:text-is('Decline all')"],
});
let browser;
before(async () => { browser = await chromium.launch({ headless: true, executablePath: process.env.TEST_CHROMIUM_PATH, args: ["--no-sandbox"] }); });
after(async () => { await browser?.close(); });

async function inspect(html, check) {
  const page = await browser.newPage();
  await page.route("https://example.com/**", (route) => route.fulfill({ contentType: "text/html", body: html }));
  try {
    const schema = await adapter.inspect("https://example.com/job", page);
    await check(schema, page);
  } finally { await page.close(); }
}

const identity = '<label>Email<input type="email" required></label>';
const resume = '<div><label>Resume *</label><div><input type="file" style="display:none"></div></div>';
const submit = '<button type="submit">Submit application</button>';
const application = `<form>${identity}${resume}${submit}</form>`;

test("declines optional cookies before opening a Workable-style application overlay", async () => {
  await inspect(`<div role="dialog" aria-label="Cookie Consent" style="position:fixed;inset:0;z-index:99;background:white"><button onclick="document.body.dataset.cookies='accepted'">Accept all</button><button onclick="document.body.dataset.cookies='declined';this.parentElement.remove()">Decline all</button></div><button data-open-application onclick='document.querySelector("main").innerHTML = ${JSON.stringify(application)}'>Apply for this job</button><main></main>`, async (schema, page) => {
    assert.equal(await page.locator("body").getAttribute("data-cookies"), "declined");
    assert.equal(schema.supportsFileUpload, true);
    assert.equal(schema.valid, true);
  });
});

test("Workable ARIA radio questions keep separate answer keys and select hidden inputs through labels", async () => {
  const radios = (name, question) => `<span id="${name}-label">${question}</span><fieldset role="radiogroup" aria-labelledby="${name}-label"><label>YES<input style="display:none" type="radio" required name="${name}" value="true"></label><label>NO<input style="display:none" type="radio" required name="${name}" value="false"></label></fieldset>`;
  await inspect(`<form>${identity}${resume}${radios("history", "Have you worked here before?")}${radios("schedule", "Can you work full time?")}<label>Confirm consent<input style="display:none" type="checkbox" required></label>${submit}</form>`, async (schema, page) => {
    const questions = schema.fields.filter(field => field.type === "radio");
    assert.equal(questions[0].label, "Have you worked here before?");
    assert.notEqual(questions[0].answerKey, questions[1].answerKey);
    const consent = schema.fields.find(field => field.type === "checkbox");
    const verified = { ...profile, verifiedApplicationAnswers: [
      { canonicalKey: questions[0].answerKey, answerType: "boolean", booleanValue: false, userConfirmed: true },
      { canonicalKey: questions[1].answerKey, answerType: "boolean", booleanValue: true, userConfirmed: true },
      { canonicalKey: consent.answerKey, answerType: "boolean", booleanValue: true, userConfirmed: true },
    ] };
    const answers = prepareAnswers(schema, verified, job).filter(answer => ["radio", "checkbox"].includes(answer.field.type));
    await adapter.submit({ page, schema, profile: verified, job, answers, resumePath: "unused", dryRun: true });
    assert.equal(await page.locator('input[name="history"][value="false"]').isChecked(), true);
    assert.equal(await page.locator('input[name="schedule"][value="true"]').isChecked(), true);
    assert.equal(await page.locator('input[type="checkbox"]').isChecked(), true);
  });
});

test("required multi-choice checkbox groups cannot be mistaken for independent consent boxes", async () => {
  await inspect(`<form>${identity}${resume}<span id="skills-label">Which skills do you have?</span><div role="group" aria-labelledby="skills-label"><label>Sales<input type="checkbox" required></label><label>Support<input type="checkbox" required></label></div>${submit}</form>`, async schema => {
    assert.deepEqual(schema.unknownRequiredFields, ["Which skills do you have?"]);
    assert.equal((await adapter.canSubmit(schema, profile)).eligible, false);
  });
});

test("Greenhouse grouped Attach inputs distinguish required CV from optional cover letter", async () => {
  const upload = (id, label, required) => `<div role="group" aria-labelledby="upload-label-${id}" aria-required="${required}"><div id="upload-label-${id}">${label}</div><div><div><div><div><button type="button">Attach</button><label for="${id}">Attach</label><input id="${id}" type="file" style="display:none"></div></div></div></div></div>`;
  await inspect(`<form>${identity}${upload("resume", "Resume/CV", true)}${upload("cover_letter", "Cover Letter", false)}${submit}</form>`, async (schema, page) => {
    assert.equal(schema.supportsFileUpload, true);
    const cv = schema.fields.find(field => field.canonicalKey === "resume");
    const cover = schema.fields.find(field => field.canonicalKey === "cover_letter");
    assert.equal(cv.required, true);
    assert.equal(cover.required, false);
    await page.locator(cv.selector).setInputFiles({ name: "resume.pdf", mimeType: "application/pdf", buffer: Buffer.from("fixture") });
    assert.equal(await page.locator(cv.selector).evaluate(input => input.files[0].name), "resume.pdf");
    assert.equal(await page.locator(cover.selector).evaluate(input => input.files.length), 0);
  });
});

test("does not duplicate a combobox with its hidden required validation proxy", async () => {
  await inspect(`<form>${identity}${resume}<div><label for="question">Question</label><input id="question" role="combobox" aria-required="true"><input required tabindex="-1" aria-hidden="true"></div>${submit}</form>`, async schema => {
    assert.equal(schema.fields.filter(field => field.label === "Question").length, 1);
    assert.equal(schema.fields.some(field => !field.label), false);
  });
});

test("upload groups preserve explicit file labels and do not make sibling files required", async () => {
  await inspect(`<form>${identity}<div role="group" aria-labelledby="documents"><span id="documents">Documents</span><input type="file" aria-label="Resume"></div><fieldset aria-required="true"><legend>Extra documents</legend><input type="file" aria-label="Portfolio"><input type="file" aria-label="Cover Letter"></fieldset>${submit}</form>`, async schema => {
    assert.equal(schema.supportsFileUpload, true);
    assert.equal(schema.fields.find(field => field.canonicalKey === "resume").label, "Resume");
    assert.equal(schema.fields.find(field => field.canonicalKey === "cover_letter").required, false);
  });
});

test("employment restrictions and visa questions never reuse company or location answers", () => {
  assert.equal(canonicalKeyFor("Are you subject to any employment agreements and/or post-employment restrictions with your current employer or a past employer?*"), null);
  assert.equal(canonicalKeyFor("Will you now or in the future require sponsorship for a visa to remain in your current location?*"), "sponsorship");
  assert.equal(canonicalKeyFor("This role is open to candidates in Poland. Are you currently located in this location?*"), null);
  assert.equal(canonicalKeyFor("Current employer"), "current_company");
  assert.equal(canonicalKeyFor("Location (City)"), "location");
});

test("waits for client-rendered application controls", async () => {
  await inspect(`<main></main><script>setTimeout(() => document.querySelector('main').innerHTML = ${JSON.stringify(application)}, 200)</script>`, async (schema) => {
    assert.equal(schema.valid, true);
    assert.equal(schema.supportsFileUpload, true);
  });
});

test("unnamed hidden upload is mapped and actually accepts a resume", async () => {
  await inspect(application, async (schema, page) => {
    const upload = schema.fields.find((field) => field.canonicalKey === "resume");
    assert.ok(upload);
    await page.locator(upload.selector).setInputFiles({ name: "resume.pdf", mimeType: "application/pdf", buffer: Buffer.from("fixture") });
    assert.equal(await page.locator(upload.selector).evaluate((input) => input.files[0].name), "resume.pdf");
    assert.equal(schema.fields.find((field) => field.canonicalKey === "email").required, true);
  });
});

test("waits for upload widgets mounted after identity fields", async () => {
  await inspect(`<form>${identity}<label>Phone<input type="tel"></label><div id="upload"></div>${submit}</form><script>setTimeout(() => document.querySelector('#upload').innerHTML = ${JSON.stringify(resume)}, 200)</script>`, async (schema) => {
    assert.equal(schema.supportsFileUpload, true);
  });
});

test("opens the application even when a newsletter form already exists", async () => {
  await inspect(`<form><input type="email" name="newsletter"><button type="submit">Subscribe</button></form><button data-open-application onclick='document.querySelector("main").innerHTML = ${JSON.stringify(application)}'>Apply</button><main></main>`, async (schema) => {
    assert.equal(schema.valid, true);
    assert.equal(schema.supportsFileUpload, true);
  });
});

test("reads externally associated upload controls", async () => {
  await inspect(`<form id="application">${identity}${submit}</form><input form="application" type="file" aria-label="Resume">`, async (schema) => {
    assert.equal(schema.supportsFileUpload, true);
    assert.ok(schema.fields.some((field) => field.canonicalKey === "resume"));
  });
});

test("does not use a newsletter submit outside the application", async () => {
  await inspect(`<form><input type="email" name="newsletter"><button type="submit">Subscribe</button></form><form>${identity}${resume}</form>`, async (schema) => {
    assert.equal(schema.submitSelector, null);
    assert.equal(schema.valid, false);
  });
});

test("does not mark wizard Continue as a final submission", async () => {
  await inspect(`<form>${identity}${resume}<button type="submit">Continue</button></form>`, async (schema) => {
    assert.equal(schema.supportsAutoSubmit, false);
    assert.equal(schema.valid, false);
  });
});

test("generic or cover-letter-only uploads do not count as resume support", async () => {
  for (const label of ["Attachment", "Cover letter"]) {
    await inspect(`<form>${identity}<input type="file" aria-label="${label}">${submit}</form>`, async (schema) => {
      assert.equal(schema.supportsFileUpload, false);
    });
  }
});

test("required non-resume uploads remain structurally unsupported", async () => {
  await inspect(`<form>${identity}${resume}<input type="file" required aria-label="Cover letter">${submit}</form>`, async (schema) => {
    assert.equal(schema.supportsFileUpload, true);
    assert.deepEqual(schema.unknownRequiredFields, ["Cover letter"]);
  });
});

test("keeps real CAPTCHA and login requirements blocked", async () => {
  await inspect(`${application}<div data-sitekey="fixture"></div>`, async (schema) => {
    assert.equal(schema.captchaDetected, true);
    assert.equal(schema.valid, false);
  });
  await inspect(`${application}<p>Sign in to apply</p>`, async (schema) => {
    assert.equal(schema.loginRequired, true);
    assert.equal(schema.valid, false);
  });
});

test("preserves radio groups and handles names containing quotes", async () => {
  await inspect(`<form>${identity}${resume}<fieldset><legend>Preferred shift *</legend><label><input type="radio" name='shift"name' value="day">Day</label><label><input type="radio" name='shift"name' value="night">Night</label></fieldset>${submit}</form>`, async (schema, page) => {
    const radio = schema.fields.find((field) => field.type === "radio");
    assert.ok(radio);
    assert.equal(radio.label, "Preferred shift *");
    assert.equal(radio.required, true);
    assert.equal(await page.locator(radio.selector).count(), 2);
    await page.locator(`${radio.selector}[value="night"]`).check();
    assert.equal(await page.locator(`${radio.selector}[value="night"]`).isChecked(), true);
  });
});

test("excludes disabled controls but retains hidden native uploads", async () => {
  await inspect(`<form>${identity}${resume}<input disabled required aria-label="Internal reference">${submit}</form>`, async (schema) => {
    assert.equal(schema.fields.some((field) => field.label === "Internal reference"), false);
    assert.equal(schema.supportsFileUpload, true);
  });
});

const countryWidget = `<label id="country-label">Country *</label>
  <input id="country" role="combobox" aria-labelledby="country-label" aria-controls="countries" aria-expanded="false" onfocus="countries.hidden=false;this.setAttribute('aria-expanded','true')" onclick="countries.hidden=false" onkeydown="if(event.key==='Escape'){countries.hidden=true;this.setAttribute('aria-expanded','false')}">
  <input type="hidden" name="country_code" id="country-code">
  <div id="countries" role="listbox" hidden><div role="option" onclick="document.querySelector('#country-code').value='AR';document.querySelector('#country').value='Argentina';this.parentElement.hidden=true">Argentina</div><div role="option">Chile</div></div>`;

test("custom combobox commits an exact option, uploads PDF and verifies fixture submission", async () => {
  const directory = await mkdtemp(join(tmpdir(), "aplica-test-"));
  const resumePath = join(directory, "resume.pdf");
  await writeFile(resumePath, "%PDF-1.4 fixture");
  try {
    await inspect(`<form onsubmit="event.preventDefault();if(document.querySelector('#country-code').value==='AR' && document.querySelector('input[type=file]').files.length && document.querySelector('input[type=email]').value==='ana@example.com') document.body.innerHTML='<h1>Application received</h1><p>Confirmation ID: FIXTURE123</p>'">${identity}${resume}${countryWidget}${submit}</form>`, async (schema, page) => {
      const combo = schema.fields.find((field) => field.type === "combobox");
      assert.deepEqual(combo.options.map((option) => option.label), ["Argentina", "Chile"]);
      assert.equal((await adapter.canSubmit(schema, profile)).eligible, true);
      const result = await adapter.submit({ page, schema, profile, job, answers: prepareAnswers(schema, profile, job), resumePath, dryRun: false });
      const verified = await adapter.verify(result);
      assert.equal(verified.verified, true);
      assert.equal(verified.verificationValue, "FIXTURE123");
    });
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("unmatched select answers fail eligibility without disabling the form for others", async () => {
  await inspect(`<form>${identity}${resume}<label>Country<select required><option value="CL">Chile</option></select></label>${submit}</form>`, async (schema) => {
    assert.equal(schema.valid, true);
    assert.equal((await adapter.canSubmit(schema, profile)).failureCode, "PROFILE_INCOMPLETE");
  });
});

test("preexisting confirmation text never verifies a rejected application", async () => {
  await inspect(`${application}<p>Application received</p><p>Confirmation ID: OLDREF123</p>`, async (schema, page) => {
    const text = await page.locator("body").innerText();
    const result = { submitted: true, dryRun: false, page, responseUrl: page.url(), priorUrl: page.url(), pageText: text, priorPageText: text };
    assert.equal((await adapter.verify(result)).verified, false);
    assert.equal((await adapter.verify({ ...result, dryRun: true, pageText: "Application received NEW" })).verified, false);
  });
});
