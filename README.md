# aplica

AI-assisted job discovery and Auto Apply for LATAM.

## Production stack

- **GitHub** — source control, CI, GitHub Pages frontend hosting, scheduled inventory sync and scheduled Playwright Auto Apply worker.
- **Supabase** — Auth, Postgres, RLS, Storage and Edge Functions.
- No Lovable runtime or backend is required.

## Supabase

Production project:

`ctdpjiyxcoytshegnpbc`

Public browser configuration is committed in `.env` using the publishable key. Privileged keys are never committed.

The database schema lives in `drizzle/migrations/`. The authenticated batch enqueue endpoint lives in:

`supabase/functions/start-auto-apply-batch/`

## Frontend

TanStack Start runs in SPA mode and can be deployed as static assets.

```bash
bun install
bun run dev
bun run build
```

GitHub Pages deployment is defined in:

`.github/workflows/pages.yml`

For a custom domain, enable GitHub Pages with **GitHub Actions** as the source and configure the domain in Repository Settings → Pages.

## Inventory

`.github/workflows/inventory-sync.yml` runs every 10 minutes and syncs registered ATS boards directly against Supabase.

## Auto Apply worker

`.github/workflows/auto-apply-worker.yml` runs the Playwright worker in one-shot mode every 5 minutes. It claims queued applications atomically from Supabase, fills supported public ATS forms and only marks an application verified after a real confirmation signal.

GitHub needs one repository secret:

`SUPABASE_SERVICE_ROLE_KEY`

Use a Supabase secret/server key. Never put it in frontend code or a `VITE_*` variable.

## Local worker

```bash
cd worker
npm ci
npx playwright install chromium
SUPABASE_URL=https://ctdpjiyxcoytshegnpbc.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=... \
WORKER_MODE=development \
DRY_RUN=true \
npm run dev
```

## Safety rules

- No CAPTCHA bypassing, stealth plugins, fingerprint spoofing or anti-bot evasion.
- Required application answers must come from verified user data.
- Sensitive answers such as sponsorship or work authorization are never inferred.
- A submission that cannot be verified is never shown as successfully sent and does not consume a credit.
