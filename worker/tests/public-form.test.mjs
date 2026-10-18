import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { chromium } from "playwright";
import { createPublicFormAdapter } from "../dist/adapters/public-form.js";

const adapter = createPublicFormAdapter({
  id: "fixture", version: "test", atsType: "fixture", hostPatterns: [/example\.com/],
  formSelector: "form", submitSelectors: ['button[type="submit"]'],
  activateSelectors: ['button[data-open-application]'],
});
let browser;
before(async () => { browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] }); });
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
