# Plan: Aplica product experience

## Goal
Build a polished, responsive Spanish-LATAM product prototype that takes a job seeker from the homepage through onboarding, matching, job review, upgrade, application tracking, and profile management. The experience will use realistic local demo data and client-side state so the full journey is interactive without pretending external services are connected.

## Experience
- Create the minimal `aplica` brand, shared navigation, typography, spacing, semantic colors, controls, transitions, mobile behavior, and accessible interaction states.
- Build the homepage around the core promise and move users directly into the product.
- Build a resumable 21-step onboarding flow with one focused question per screen, progress, validation, CV upload/parsing simulation, editable profile details, preference controls, truthful-data consent, and a short matching sequence.
- Build search-style job results with realistic match explanations, concerns, filters, sorting, expandable details, save/select controls, empty/error states, and a dynamic sticky apply action.
- Gate mass application behind the required upgrade screen, with clear weekly recurring plans and no misleading checkout success.
- Build applications, profile, settings, login, and signup screens, plus job-detail and post-upgrade selection/queue states.
- Keep all visible copy in Spanish LATAM and place copy/data in structures that can later be translated.

## Product state
- Add reusable typed models for profile, jobs, match factors, subscription, applications, and queue statuses.
- Use a shared client-side product store for this prototype, with realistic seeded jobs and applications.
- Persist non-sensitive progress locally so refreshes do not erase the demo journey; isolate persistence so it can later be replaced by real services.
- Implement truthful status changes only: simulated applications will remain clearly demonstrative and will never claim a real submission occurred.

## Routes
- `/` home
- `/login`, `/signup`
- `/onboarding`
- `/jobs`, `/jobs/$id`
- `/upgrade`
- `/applications`
- `/profile`
- `/settings`

Each route will include unique search and sharing metadata.

## Validation
- Verify the principal desktop and mobile journeys in the running app.
- Check navigation, onboarding progression, dynamic job selection totals, paywall routing, and responsive sticky actions.
- Inspect the final interface for overflow, overlap, accessibility labels, and console errors.

## Scope note
Real CV extraction, authentication, payments, WhatsApp delivery, job sourcing, and external application submission require connected services and are represented by honest interactive demo states in this version.
