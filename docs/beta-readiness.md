# Aplica beta readiness — 24 October 2026

The new production deployment uses `ctdpjiyxcoytshegnpbc`. Source: `agrodeo/aplica-career-path`.

## Deployment and domain gate

The new build is deployed at `https://agrodeo.github.io/aplica-career-path/`. A live bundle check confirms it uses `ctdpjiyxcoytshegnpbc`.

The custom domain `https://aplica.lat` still serves the older build and its bundle uses `hqejjuvugvskhisfttqb`. Its nameservers are `dns1.registrar-servers.com` and `dns2.registrar-servers.com`; its A record is `185.158.133.1`. Connecting the custom domain to the new deployment and verifying auth redirects is a launch gate. Do not change DNS without access to the domain account and a completed routing plan.

The zero-profile finding below applies to the new database only. It does not establish that the older deployment has no users. Check whether existing accounts need migration before replacing the old site.

## Verified in the new production project

- The Auto Apply workflow has successful scheduled executions on 24 October; LATAM inventory sync also completes.
- Production contains zero career profiles, subscriptions and application attempts at the time of this audit. No real employer submission has been verified.
- Database logs include statement timeouts. A full inventory aggregate timed out; smaller bounded operational queries succeeded. Do not treat a failed query as a zero count.
- Supabase security advisors returned no findings during this audit.

## Implemented for the beta

- Applications history reads the signed-in user's attempts, rather than demonstration data. Empty, loading and database-error states are distinct. Only verified attempts appear in the sent filter.
- Unconfirmed submissions, CAPTCHA, login and incomplete-profile cases explain the next action. Unconfirmed sends warn against duplicate applications. The original employer form is available when human action is needed.
- An application can open its exact stored CV through a one-minute signed URL, protected by user ownership and existing Storage RLS.
- Batch progress uses scoped realtime subscriptions with polling fallback.
- Live matching respects employment type, seniority, company exclusions, modality and geography. A remote label does not establish worldwide eligibility; unknown geography or modality is excluded pending clarification. City preferences do not automatically expand to the entire country. Detected explicit residence requirements remain in force.
- Job and plan caches are scoped by authenticated user. Failed profile/plan queries surface as errors.
- Plan prices and limits come from the production catalog. The fake purchase and local subscription activation have been removed. Checkout remains unavailable until a real payment provider is connected.
- Worker CV validation checks achievements against the specific employer and checks education, language level and summary against the source profile.
- `Beta Health` checks source/inspection freshness every six hours and saves aggregate reports for fourteen days. It performs GET requests only and submits no applications. It fails on unavailable data or activity older than six hours. Application status counts are sampled to at most 1,000 rows; the report separately identifies the total count.

## Validation

Run the checks configured in `.github/workflows/ci.yml`:

```sh
bun test src/lib/job-sources/ src/lib/auto-apply/ scripts/beta-health.test.ts
bun run build
npm ci --prefix worker
npx --prefix worker playwright install --with-deps chromium
node scripts/verify-browser-flow.mjs
npm test --prefix worker
```

The browser test uses intercepted Supabase responses and a controlled application fixture. Worker tests exercise real local browser form filling and confirmation, isolated database behavior, credit idempotency, CV claims and failure recovery. These are engineering checks, not evidence of an employer receiving a real candidate's application.

The repository-wide `tsc --noEmit` also reports existing strict-type issues in the discovery/admin code and missing Bun test types. It is not an existing CI gate. The application build and worker typecheck are the current CI gates.

## Real beta still to run

1. Enroll 5–10 consenting candidates. Each registers, uploads/reviews their CV and confirms application answers. No candidate identity or answer is fabricated.
2. Grant a time-limited beta subscription administratively to each enrolled account. No payment is taken. A profile or user ID is required first; production has none yet.
3. Start with one Greenhouse role per candidate. Confirm role, country, seniority, generated CV and required answers before the candidate authorizes submission.
4. Verify an employer confirmation/reference, the stored attempt, the used CV and exactly one consumed credit. Escalate CAPTCHA/login to the candidate. Review uncertain submissions before any retry.
5. Observe at least three days of worker and health reports. Recheck matching with the candidates, review every failed attempt, and increase volume only after the first submissions are verified.

## Remaining launch gates

- Connect `aplica.lat` to the new deployment, verify signup/login redirects, and assess existing accounts in the old backend before switching traffic.

- At least one real candidate-to-employer verified submission, then the supervised cohort.
- Payment provider, server-side checkout/webhooks and verified subscription activation/cancellation. The catalog alone is not billing.
- Real WhatsApp delivery is not validated by this change.
- Broad ATS coverage remains dependent on individual form inspection; the first beta should focus on Greenhouse.
