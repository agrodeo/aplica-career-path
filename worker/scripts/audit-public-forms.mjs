import { chromium } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { resolveAdapter } from '../dist/adapters/registry.js';

// Public inspection only. No profiles, files, answers, submit calls or DB writes.
// Structural support is separate from completion and employer receipt.
const samples = JSON.parse(await readFile(new URL('../audits/public-samples.json', import.meta.url), 'utf8')).slice(0, 40);
const output = resolve(process.argv[2] ?? '.artifacts/public-form-audit.json');
const results = new Array(samples.length);
let writes = Promise.resolve();
const checkedAt = new Date().toISOString();
await mkdir(resolve(output, '..'), { recursive: true });
function checkpoint(completed = false) {
  const payload = JSON.stringify({ checkedAt, mode: 'public_inspection_only', total: samples.length, completed, completionTested: false, verifiedApplications: 0, results: results.filter(Boolean) }, null, 2) + '\n';
  writes = writes.then(() => writeFile(output, payload));
  return writes;
}
await checkpoint();
const safeUrl = url => { try { const u = new URL(url); return u.origin === 'null' ? u.protocol : u.origin + u.pathname; } catch { return ''; } };
const browser = await chromium.launch({ headless: true, executablePath: process.env.TEST_CHROMIUM_PATH, args: ['--no-sandbox'] });
async function inspectSample({provider, url}) {
  const context = await browser.newContext();
  await context.addInitScript(() => document.addEventListener('submit', event => event.preventDefault(), true));
  const page = await context.newPage();
  const failedRequests = [];
  page.on('requestfailed', request => {
    if (failedRequests.length < 5 && ['document', 'script', 'xhr', 'fetch'].includes(request.resourceType())) failedRequests.push({ host: new URL(request.url()).hostname, type: request.resourceType(), error: request.failure()?.errorText });
  });
  const started = Date.now();
  let result;
  try {
    const adapter = resolveAdapter(url);
    const schema = await adapter.inspect(url, page);
    const blockers = [
      ...(schema.captchaDetected ? ['CAPTCHA_PRESENT'] : []),
      ...(schema.loginRequired ? ['LOGIN_REQUIRED'] : []),
      ...(!schema.fields.length ? ['NO_FORM'] : []),
      ...(!schema.supportsFileUpload ? ['NO_RESUME_UPLOAD'] : []),
      ...(!schema.submitSelector ? ['NO_FINAL_SUBMIT'] : []),
      ...(schema.unknownRequiredFields.length ? ['UNSUPPORTED_REQUIRED_FIELDS'] : []),
    ];
    result = { provider, url, adapter: adapter.id, adapterVersion: adapter.version, inspectable: schema.valid && !blockers.length, captchaPresent: schema.captchaPresent ?? schema.captchaDetected, blockers, fields: schema.fields.slice(0, 100).map(({ label, type, required, canonicalKey, options }) => ({ label, type, required, canonicalKey, optionsCount: options?.length ?? 0 })), submitted: false };
  } catch (error) {
    result = { provider, url, inspectable: false, blockers: [error.code ?? 'NETWORK_ERROR'], error: String(error.message).slice(0, 500), submitted: false };
  } finally {
    // Fresh contexts contain only public listings. Never capture field values.
    Object.assign(result, {
      elapsedMs: Date.now() - started,
      title: await page.title().catch(() => ''),
      landingUrl: safeUrl(page.url()),
      pageSummary: (await page.locator('body').innerText({ timeout: 2000 }).catch(() => '')).slice(0, 700),
      buttons: await page.getByRole('button').allTextContents().catch(() => []),
      frames: await Promise.all(page.frames().filter(frame => frame !== page.mainFrame()).slice(0, 6).map(async frame => ({url: safeUrl(frame.url()), inputs: /captcha|challenges.cloudflare/i.test(frame.url()) ? null : await frame.locator('input,textarea,select').count().catch(() => 0)}))),
      openedPages: context.pages().filter(opened => opened !== page).map(opened => safeUrl(opened.url())),
      failedRequests,
    });
    await context.close();
  }
  return result;
}
let cursor = 0;
try {
  await Promise.all(Array.from({ length: 2 }, async () => {
    while (cursor < samples.length) {
      const index = cursor++;
      results[index] = await inspectSample(samples[index]);
      console.log(JSON.stringify(results[index]));
      await checkpoint();
    }
  }));
} finally { await browser.close(); await writes; }
await checkpoint(true);
console.log(`Inspected ${results.length} public forms; ${results.filter(r => r.inspectable).length} structurally supported. Completion not tested; no applications submitted. Report: ${output}`);
