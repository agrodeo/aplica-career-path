# Deploy Aplica outside Lovable

Target: Cloudflare Pages Free for the static web app, Supabase project `ctdpjiyxcoytshegnpbc` for Auth/data/storage/Edge Functions, and GitHub Actions for the Playwright worker and discovery. Cloudflare does not run the worker or require its service-role key.

The source repository is `agrodeo/aplica-career-path`, branch `main`.

## Cloudflare project

Create a **Pages** project with Git integration (not a Worker), select this repository, and use:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Framework preset | `None` |
| Root directory | repository root (leave blank) |
| Build command | `bun run build:pages` |
| Build output directory | `dist/client` |
| `VITE_BASE_PATH` | `/` |
| `VITE_SUPABASE_URL` | `https://ctdpjiyxcoytshegnpbc.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | the matching public key already committed in the repository `.env` |

The public key is intended for the browser; row access is enforced by Supabase RLS. Never configure `SUPABASE_SERVICE_ROLE_KEY` in Cloudflare or in any `VITE_*` variable. The existing privileged key stays in GitHub's worker secret.

`build:pages` produces the Vite SPA at `/`, copies its shell to `index.html`, and removes any top-level GitHub-style `404.html`. Cloudflare then serves `index.html` for non-asset paths. This allows direct visits and refreshes on `/login`, `/jobs`, `/applications` and `/applying`. The server output in `dist/server` must not be published.

First verify the assigned `pages.dev` URL, including registration/login, profile persistence and the production Supabase hostname. The deployed URL is not known until the project is created; do not invent one.

## Domain cutover

1. Add `aplica.lat` to **this Pages project's Custom domains** before changing DNS.
2. For the apex domain, Cloudflare requires the domain's DNS zone in the same Cloudflare account. Import/review the current DNS records, especially existing email records, and use only the nameserver pair assigned to this zone by Cloudflare. The registrar itself does not need to change.
3. Update nameservers at the current registrar after the records and Pages target have been checked. Do not guess the assigned nameservers or remove email records.
4. Confirm the Pages custom domain is active, TLS is working, and both the homepage and refreshed nested routes load from the new build.
5. Configure and verify Supabase's Auth Site URL and allowed redirects for `https://aplica.lat`. Add the exact temporary Pages origin if needed for the pre-cutover test; do not use broad wildcard auth redirects.
6. Check whether users or files in the older project `hqejjuvugvskhisfttqb` need migration. The new project's earlier zero-profile count does not prove the old project has no users.
7. After a real login and data check succeed on `aplica.lat`, disconnect Lovable's Git sync and remove its custom-domain association. Cancel Lovable's subscription if desired. Keep the older database until migration requirements are resolved.

GitHub Pages is only an old engineering preview. It is not the chosen commercial production host. After Cloudflare's production URL and domain are verified, disable the obsolete Pages deploy workflow to avoid maintaining two competing production destinations. The worker and CI workflows remain active.

References:
- https://developers.cloudflare.com/pages/configuration/build-configuration/
- https://developers.cloudflare.com/pages/configuration/serving-pages/#single-page-application-spa-rendering
- https://developers.cloudflare.com/pages/configuration/custom-domains/
