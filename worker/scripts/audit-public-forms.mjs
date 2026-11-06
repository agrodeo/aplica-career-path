import { chromium } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { resolveAdapter } from '../dist/adapters/registry.js';

// Inspects public forms only: no profile, uploads, answers, queue, DB writes or
// submit calls. A green report means inspectable, never a verified application.
const samples = JSON.parse(await readFile(new URL('../audits/public-samples.json', import.meta.url), 'utf8'));
const output = resolve(process.argv[2] ?? '.artifacts/public-form-audit.json');
const browser = await chromium.launch({ headless: true, executablePath: process.env.TEST_CHROMIUM_PATH, args: ['--no-sandbox'] });
const results = [];
try {
  for (const { provider, url } of samples) {
    const context = await browser.newContext();
    await context.addInitScript(() => document.addEventListener('submit', event => event.preventDefault(), true));
    const page = await context.newPage();
    const failedRequests = [];
    page.on('requestfailed', request => {
      if (failedRequests.length < 5 && ['document', 'script', 'xhr', 'fetch'].includes(request.resourceType())) {
        failedRequests.push({ host: new URL(request.url()).hostname, type: request.resourceType(), error: request.failure()?.errorText });
      }
    });
    const started = Date.now();
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
      results.push({ provider, url, adapter: adapter.id, adapterVersion: adapter.version, inspectable: schema.valid && !blockers.length, blockers, fields: schema.fields.map(({ label, type, required, canonicalKey }) => ({ label, type, required, canonicalKey })), elapsedMs: Date.now() - started, submitted: false });
    } catch (error) {
      results.push({ provider, url, inspectable: false, blockers: [error.code ?? 'NETWORK_ERROR'], error: String(error.message).slice(0, 500), elapsedMs: Date.now() - started, submitted: false });
    } finally {
      // Fresh contexts contain only public listings, never candidate data.
      Object.assign(results.at(-1), {
        title: await page.title().catch(() => ''),
        landingUrl: page.url(),
        pageSummary: (await page.locator('body').innerText({ timeout: 2000 }).catch(() => '')).slice(0, 700),
        buttons: await page.getByRole('button').allTextContents().catch(() => []),
        failedRequests,
      });
      await context.close();
    }
    console.log(JSON.stringify(results.at(-1)));
  }
} finally { await browser.close(); }
await mkdir(resolve(output, '..'), { recursive: true });
await writeFile(output, JSON.stringify({ checkedAt: new Date().toISOString(), mode: 'public_inspection_only', verifiedApplications: 0, results }, null, 2) + '\n');
console.log(`Inspected ${results.length} public forms; ${results.filter(r => r.inspectable).length} inspectable. No applications submitted. Report: ${output}`);
