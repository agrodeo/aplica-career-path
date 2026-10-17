# Aplica Auto Apply worker

Standalone, independently deployable Node.js + TypeScript service. It is the only
component that opens a browser, fills a real application form, submits it and
verifies the result. It can run locally or in scheduled one-shot mode from GitHub Actions.

## Loop

```
claim queued application (atomic, SKIP LOCKED)
  → load job
  → load MasterProfile
  → inspect application schema
  → verify eligibility
  → get or generate the job-specific CV (cached by user + job + profile version)
  → prepare deterministic answers
  → select adapter
  → submit
  → verify
  → store evidence + snapshot
  → mark verified  → 1 credit consumed
```

A submission that cannot be verified never consumes a credit and is never shown
to the user as "Enviada".

## Environment

| Variable | Notes |
| --- | --- |
| `SUPABASE_URL` | backend URL |
| `SUPABASE_SERVICE_ROLE_KEY` | service role, worker-only |
| `WORKER_MODE` | `development` \| `production` |
| `DRY_RUN` | `true` fills everything and stops before the final Submit. Must be `false` in production |
| `WORKER_ID` | optional identifier used when claiming work |
| `RUN_ONCE` | `true` processes one queue cycle and exits; used by GitHub Actions |
| `POLL_INTERVAL_MS`, `MAX_CONCURRENCY`, `LOG_LEVEL` | optional tuning |

`WORKER_MODE=production` with `DRY_RUN=true` refuses to start: production must
never produce a fake successful submission.

## Run

```bash
npm install
npx playwright install chromium   # not needed inside the Docker image
npm run dev                       # or: npm run build && npm start
docker build -t aplica-worker . && docker run --env-file .env aplica-worker
```

## Supported families

Public-form adapters are enabled for Greenhouse, Lever, Ashby, Workable, SmartRecruiters and Workday. Each individual posting must still pass runtime inspection before Auto Apply is allowed.

## Hard rules

- No CAPTCHA solving, stealth plugins, fingerprint spoofing, proxy rotation or
  anti-bot evasion. Blocked automation returns `AUTOMATION_BLOCKED` and the job
  leaves the Auto Apply inventory.
- A required question that cannot be answered from MasterProfile or a confirmed
  application answer makes the job unsupported. Answers are never invented.
- Work authorization, sponsorship, salary, demographic and criminal-history
  questions are answered only from explicitly stored answers; optional
  demographic questions pick an explicit "decline to answer" option when present.
- Free-text answers are composed from verified facts and pass
  `validateGeneratedAnswer()` before submission.
- Verification requires a real signal: application identifier, confirmation page
  or an explicit success message. A screenshot is captured after submission and
  stored privately.

## Failure codes

`JOB_EXPIRED`, `DUPLICATE_APPLICATION`, `UNSUPPORTED_FIELD`, `CAPTCHA_PRESENT`,
`LOGIN_REQUIRED`, `AUTOMATION_BLOCKED`, `FILE_UPLOAD_FAILED`, `FORM_CHANGED`,
`NETWORK_ERROR`, `SUBMISSION_REJECTED`, `VERIFICATION_FAILED`, `UNKNOWN_ERROR`.

Retried: `NETWORK_ERROR`, `FORM_CHANGED`, `FILE_UPLOAD_FAILED`, `UNKNOWN_ERROR`.
Never retried: `CAPTCHA_PRESENT`, `LOGIN_REQUIRED`, `UNSUPPORTED_FIELD`,
`AUTOMATION_BLOCKED`.

### Inspection notes

The inspector scores candidate forms and selects the application form with the strongest application-field signals before determining CV upload and required-field support.

The production inspection queue prioritizes likely-inspectable ATS families (Greenhouse first) before providers that commonly require CAPTCHA, login, or block browser automation.
