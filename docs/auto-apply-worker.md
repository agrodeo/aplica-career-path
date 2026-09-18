# Aplica Auto Apply — external worker contract

Aplica is Auto Apply only. The external browser worker is intentionally isolated
from the database.

```
Frontend
   ↓
Aplica backend / Supabase
   ↓ narrow token API
External worker
   ↓
supported ATS public form / authorized API
   ↓
verification
   ↓ narrow token API
Aplica backend
```

## Security boundary

The external worker receives **no Supabase service-role key** and has no generic
database endpoints. It receives PII only for the one application it has claimed.

Backend endpoints authenticate:

```http
Authorization: Bearer $AUTO_APPLY_WORKER_TOKEN
```

The server may accept a current/previous token during rotation. Tokens live only
in server/worker secrets.

## Worker endpoints

### `POST /api/public/worker/claim-application`

Claims exactly one queued application atomically and returns a scoped processing
payload:

```json
{ "worker_id": "worker-01" }
```

Response contains the queue/attempt IDs, one job, one MasterProfile, verified
application answers, preferences, consent and subscription metadata. There is no
bulk profile endpoint.

### `POST /api/public/worker/heartbeat`

Extends the processing lock for an attempt owned by that worker.

### `POST /api/public/worker/create-upload`

Returns a short-lived signed upload URL for either the generated resume PDF or a
post-submission evidence PNG. Bucket/path are derived server-side from the owned
attempt; the worker cannot select an arbitrary path.

### `POST /api/public/worker/resume-variant`

Persists a validated resume variant for the owned attempt. User ID and job ID are
derived server-side. A stale MasterProfile version is rejected.

### `POST /api/public/worker/jobs/:queueId/status`

Allowed progress states: `preparing`, `resume_generating`, `ready`,
`submitting`, `submitted_unverified`. The caller must provide its
`worker_id`, and the queue row must currently belong to it.

### `POST /api/public/worker/jobs/:queueId/submission`

A submission becomes verified only when the worker supplies a real verification
signal and submission reference. The backend stores the exact answers/profile/job
snapshot, completes the attempt transactionally, and only then consumes one
application credit.

### `POST /api/public/worker/jobs/:queueId/failure`

The backend validates ownership and classifies retries. Transient failures use
backoff; permanent adapter blockers can remove the job from Auto Apply inventory.

Crucially, `PROFILE_INCOMPLETE` does **not** remove a job globally.

### Inspection endpoints

- `POST /api/public/worker/inspections/claim`
- `POST /api/public/worker/inspections/:id/result`

These power the admin adapter inspector. The current URL-only inspection checks
form structure/capabilities; a full profile-aware DRY RUN must use a queued test
application so the worker has a real MasterProfile and CV context.

## Greenhouse milestone

Only the Greenhouse public-form adapter is enabled. A job is eligible only if:

- the form loads without CAPTCHA/login blockers,
- required fields are understood,
- the current user has all required explicit answers,
- the resume can be uploaded,
- the submit control is supported,
- a post-submit verification signal can be recognized.

No anti-bot or access-control bypass is implemented.
