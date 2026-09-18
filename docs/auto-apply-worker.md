# Aplica Auto Apply — external worker contract

Aplica is Auto Apply only. A job reaches users **only** when a supported adapter
can submit **and** verify the application end to end (`auto_apply_eligible = true`).

```
Frontend → Backend (Postgres + queue) → External Auto Apply Worker → ATS adapter
        → employer form / authorized API → verification → Backend
```

The worker runs outside the app (Railway, Fly.io, Render). It is the only place
that performs HTTP requests to an ATS, file uploads, Playwright automation where
permitted, and submission verification.

## Authentication

All endpoints require the service credential:

```
Authorization: Bearer $WORKER_SERVICE_TOKEN
```

The token is stored as a server-side secret and is never exposed to the browser.

## Endpoints

Base URL (preview): `https://project--bd0e59ea-eb97-4ba2-b7c3-f9878bca813a-dev.lovable.app`
Base URL (production): `https://project--bd0e59ea-eb97-4ba2-b7c3-f9878bca813a.lovable.app`

### `POST /api/public/worker/jobs/claim`
Atomically claims queued work (`FOR UPDATE SKIP LOCKED`), so two workers never
process the same application.

```json
{ "workerId": "worker-1", "limit": 5 }
```

Returns `{ "claimed": [ { "id": "<queue id>", "user_id": "...", "job_id": "...", "attempt_id": "..." } ] }`.

### `POST /api/public/worker/jobs/:id/status`
`:id` is the queue row id. Allowed values: `preparing`, `resume_generating`,
`ready`, `submitting`, `submitted_unverified`.

### `POST /api/public/worker/jobs/:id/submission`
Reports the outcome. A credit is consumed **only** here, and only with a real
verification signal:

```json
{
  "verified": true,
  "verificationSignal": "api_response",
  "submissionReference": "gh_application_123",
  "evidencePath": "evidence/attempt-id.png",
  "answers": {},
  "profileSnapshot": {},
  "jobSnapshot": {},
  "resumeVariantId": "..."
}
```

Without `verified: true` plus a signal and reference, the attempt stays
`submitted_unverified` and the user never sees "Enviada".

### `POST /api/public/worker/jobs/:id/failure`

```json
{ "errorCode": "form_changed", "errorMessage": "...", "retryable": true, "delaySeconds": 600 }
```

Non-retryable failures accept `status`: `failed_permanent`, `expired`, `unsupported`.

## Hard rules for the worker

- Never bypass CAPTCHA, MFA, fingerprinting or anti-bot protection; never rotate
  proxies to evade restrictions and never store employer credentials.
- If a job requires CAPTCHA, MFA, unsupported login, human verification or a
  third-party account, set `auto_apply_eligible = false` and report `unsupported`.
- Never report a submission as verified without a documented success signal.
- Every CV and answer must come from `MasterProfile`; fact validation runs before
  any PDF is produced (`resume_variants.validation_status`).

## Adapter capabilities

`adapter_registry` tracks each adapter separately:
`discovery`, `schema_discovery`, `submission`, `verification`,
`public_discovery_supported`, `authorized_submission_supported`,
`public_form_submission_supported`, plus `connection_status` and `health`.

Greenhouse, Lever, Ashby and Workable currently ship with public discovery and
schema discovery declared, and `submission = false` / `verification = false`
until a real authorized integration exists. Until then no job becomes Auto Apply
inventory — by design, not as a placeholder success state.
