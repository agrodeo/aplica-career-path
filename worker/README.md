# Aplica Auto Apply worker

Standalone Node.js + TypeScript + Playwright service. It is the only component
that opens a browser, fills a real application form, submits it and verifies the
result. Deploy it independently from the web app.

The worker is deliberately treated as an **untrusted execution boundary**: it
never receives a Supabase service-role key or arbitrary database access.

## Loop

```
claim one application through the narrow backend API
  → receive one scoped job + MasterProfile payload
  → inspect the application form
  → verify adapter + profile eligibility
  → generate a truthful job-specific CV
  → upload CV through a short-lived signed URL
  → prepare deterministic answers
  → submit with the ATS adapter
  → verify a real success signal
  → upload evidence through a signed URL
  → report exact snapshot
  → backend marks verified and consumes 1 credit
```

A submission that cannot be verified never consumes a credit and is never shown
to the user as **Enviada**.

## Environment

| Variable | Notes |
| --- | --- |
| `APLICA_API_BASE_URL` | Deployed Aplica web/backend URL |
| `AUTO_APPLY_WORKER_TOKEN` | Dedicated worker token. Never expose it to the browser |
| `WORKER_MODE` | `development` or `production` |
| `DRY_RUN` | `true` fills everything and stops before final Submit |
| `WORKER_ID` | Unique worker identifier; set explicitly in deployment |
| `POLL_INTERVAL_MS` | Optional, default 5000 |
| `MAX_CONCURRENCY` | Optional, 1–4, default 1 |
| `LOG_LEVEL` | Optional |

Legacy `WORKER_SERVICE_TOKEN` is accepted by the worker as a temporary alias
while deployments migrate. New deployments should use
`AUTO_APPLY_WORKER_TOKEN`.

**Do not configure `SUPABASE_SERVICE_ROLE_KEY` in the worker.**

`WORKER_MODE=production` with `DRY_RUN=true` refuses to start.

## Run

```bash
npm install
npx playwright install chromium
npm run typecheck
npm run dev

# Docker
docker build -t aplica-worker .
docker run --env-file .env aplica-worker
```

## Supported family

Only `greenhouse_public_form` is enabled for the first milestone. Lever remains
out of the adapter registry until Greenhouse works end to end.

The adapter uses the public employer application form where automatic submission
is supported. It does not assume that an employer-authorized Greenhouse write API
is available.

## Hard rules

- No CAPTCHA solving, stealth plugins, fingerprint spoofing, MFA bypass, proxy
  rotation for evasion, or other anti-bot circumvention.
- Global form limitations and user-specific missing data are separate:
  - `UNSUPPORTED_FIELD` means the adapter/form itself cannot handle the job.
  - `PROFILE_INCOMPLETE` means this user lacks an explicit required answer; the
    job is **not** removed for other users.
- Work authorization, sponsorship, salary and other sensitive answers are never
  inferred.
- Required select/radio fields are only answered when a stored/profile value maps
  to a real option. The worker never guesses an option.
- The MVP uploads only the generated resume. A required additional file makes
  the form unsupported.
- Free-text generated answers use only verified MasterProfile facts and are
  validated before submission.
- Verification requires an application identifier, explicit success message or
  confirmation page.
- Evidence and CV files are uploaded through short-lived signed URLs.

## Failure codes

Global/job blockers:
`UNSUPPORTED_FIELD`, `CAPTCHA_PRESENT`, `LOGIN_REQUIRED`,
`AUTOMATION_BLOCKED`, `JOB_EXPIRED`.

User/application outcomes:
`PROFILE_INCOMPLETE`, `DUPLICATE_APPLICATION`, `DRY_RUN_COMPLETE`.

Transient failures:
`NETWORK_ERROR`, `FORM_CHANGED`, `FILE_UPLOAD_FAILED`, `UNKNOWN_ERROR`.

Other terminal failures:
`SUBMISSION_REJECTED`, `VERIFICATION_FAILED`.


## Fact-grounded AI tailoring

The worker can optionally improve resume wording per job without inventing facts.

Set both:

```env
OPENAI_API_KEY=...
RESUME_LLM_MODEL=...
# Optional: use a cheaper model for the second-pass factual entailment check.
RESUME_LLM_VERIFIER_MODEL=...
```

If either variable is missing, Aplica keeps the deterministic resume copy.

When enabled, the worker sends only the target job, writing preferences and
confirmed FactLedger claims needed for tailoring. Requests use `store: false`.
The writer must return structured copy with explicit FactLedger IDs for every
generated sentence. A second strict entailment pass (using
`RESUME_LLM_VERIFIER_MODEL`, or the writer model when omitted) must also mark
every sentence as fully supported. Deterministic validators reject generated
copy when it:

- cites an unknown or unconfirmed fact,
- uses a fact that is not allowed for resumes,
- introduces a numeric claim that is absent from its cited facts,
- changes an employer, title or date,
- fails provenance validation for any bullet or summary.

Rejected AI output never blocks the application: the worker falls back to the
truthful deterministic resume.


## Fact-grounded narrative application answers

Open-ended ATS questions can also be polished from the verified Career Profile.

Optional configuration:

```env
# Falls back to RESUME_LLM_MODEL when omitted.
APPLICATION_LLM_MODEL=...

# Falls back to RESUME_LLM_VERIFIER_MODEL, then the writer model.
APPLICATION_LLM_VERIFIER_MODEL=...
```

Supported narrative families currently include motivation, about-you,
challenge, proud-achievement and cover-letter style questions.

The flow is conservative:

```text
deterministic truthful draft
  -> optional writer
  -> explicit source IDs
  -> numeric/source validation
  -> semantic entailment verifier
  -> final answer
```

If the writer, verifier or validation fails, Aplica keeps the deterministic
answer. Job-description requirements may be referenced as facts about the job,
but they may never be converted into candidate qualifications without a
confirmed candidate source. Requests use `store: false`.
