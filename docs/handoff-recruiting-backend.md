> ⚠️ **Superseded (2026-07-21).** Everything below describes the earlier `Exec_Application`/`Recruiting_Cycle` draft from PRs #183/#184. After a planning meeting the requirements changed significantly (form builder with shared general questions + per-role forms, a 10-stage status pipeline, email-allowlist permissions, etc.). The current schema lives in `supabase/migrations/20260721000000_recruiting_schema.sql` on `feat/recruiting-schema`. #183/#184 are expected to be closed. Keeping this doc for historical context only.

# Context Handoff — Recruiting Dashboard (Backend, Applicant Submissions)

**Date:** 2026-06-24
**Owner:** Ege (egetaslicay)
**Epic:** [Recruiting Dashboard #4](https://github.com/UBC-Product-Management-Club/pmc-portal-be/issues/4)
**Project board:** https://github.com/orgs/UBC-Product-Management-Club/projects/7

## TL;DR
Built and shipped the applicant submission backend ([#177](https://github.com/UBC-Product-Management-Club/pmc-portal-be/issues/177)), which also delivered the submission DB schema ([#176](https://github.com/UBC-Product-Management-Club/pmc-portal-be/issues/176)). It's in **[PR #183](https://github.com/UBC-Product-Management-Club/pmc-portal-be/pull/183)**, open for review by Simoon. Next up is **[#178](https://github.com/UBC-Product-Management-Club/pmc-portal-be/issues/178)** (statuses + reviewer permissions), not started.

## What's done

**[PR #183](https://github.com/UBC-Product-Management-Club/pmc-portal-be/pull/183)** — branch `feat/applicant-submission-endpoints` → covers [#177](https://github.com/UBC-Product-Management-Club/pmc-portal-be/issues/177) and [#176](https://github.com/UBC-Product-Management-Club/pmc-portal-be/issues/176)

- **`Application` table** created directly in Supabase (SQL run in dashboard, **RLS enabled**). Columns: `application_id`, `user_id` (FK→User, text), `form_id` (nullable placeholder), `application_data` (jsonb), `status` (enum), `submitted_at`. `unique(user_id)`.
- **`APPLICATION_STATUS`** enum: `SUBMITTED / UNDER_REVIEW / ACCEPTED / REJECTED`.
- **Endpoints:**
  - `POST /api/v2/application` — submit (Auth0 `authenticated`, ties to `req.user.user_id`)
  - `GET /api/v2/application/me` — view own
  - `GET /api/v2/admin/applications` — list (gated by `supabaseJwtCheck`)
  - `GET /api/v2/admin/applications/:id` — view one
- **Architecture:** route → service → repository → supabase, zod validation. Mirrors the existing `Attendee` pattern.
- **Tests:** 12 ApplicationService unit tests; full suite 82/82; `npm run build` clean.
- **Review done** (`/code-review` high): fixed null-`application_data` validation (→400 not 500) and duplicate-submit race (maps Postgres `23505` → friendly error). Two findings left as known/deferred (see below).

### Files
- `src/schema/v2/Application.ts` — zod submission schema
- `src/schema/v2/database.types.ts` — `Application` table types + `APPLICATION_STATUS` enum
- `src/storage/ApplicationRepository.ts` — supabase queries
- `src/services/Application/ApplicationService.ts` — business logic
- `src/routes/v2/application.ts` — applicant routes
- `src/routes/v2/admin/application.ts` — admin routes
- `src/routes/v2/index.ts`, `src/routes/v2/admin/index.ts` — route registration
- `tests/setup.ts`, `tests/services/Application/ApplicationService.test.ts` — tests

## Key technical notes
- `User.user_id` is **text** (Auth0 IDs like `auth0|...`), not uuid — that's why `Application.user_id` is text.
- Backend uses the **service-role key**, which bypasses RLS — that's why RLS-on doesn't break the endpoints.
- The schema is **not in a migration file** — it lives in Supabase. The only git artifact is the hand-written types in `src/schema/v2/database.types.ts`. If columns change, regenerate or hand-edit that file.
- `form_id` is a **nullable placeholder, no FK yet** — waiting on #174.

## Open items / decisions
1. **`form_id` link** — needs Connor's [#174](https://github.com/UBC-Product-Management-Club/pmc-portal-be/issues/174) recruiting-form table before adding the FK and switching `unique(user_id)` → `unique(user_id, form_id)`. One-line `ALTER TABLE` once #174 lands.
2. **Admin reads are open** — `supabaseJwtCheck` lets *any* authenticated Supabase user read submissions. Reviewer-only gating deferred to [#178](https://github.com/UBC-Product-Management-Club/pmc-portal-be/issues/178)/[#38](https://github.com/UBC-Product-Management-Club/pmc-portal-be/issues/38). (Flagged in PR description.)
3. **#176 ownership** — assigned to Connor but built by Ege. Messaged him; PR uses `Closes #176`. Confirm he's ok closing it.
4. **Manual smoke test** still pending — haven't POSTed a real submission against the live table (tests + build pass, but no end-to-end run).
5. **Feature flag** — decided N/A (net-new endpoints). Optional env-var kill-switch (`APPLICATIONS_ENABLED`) discussed but not added.

## Next: [#178](https://github.com/UBC-Product-Management-Club/pmc-portal-be/issues/178) (not started)
"Add backend support for applicant statuses and reviewer permissions" — two parts:
- **Status updates** — enum/column exist; needs a `PATCH/PUT` endpoint to change `status`. Quick, data's ready.
- **Reviewer permissions** — DONE via email-domain enforcement (see below). Note: [#38](https://github.com/UBC-Product-Management-Club/admin-portal/issues/38) is in the **admin-portal (frontend) repo** — frontend counterpart, no backend duplication.

### #178 — DONE (branch `feat/applicant-status-updates`, stacked on #183)
**Status updates (criteria 1–2):**
- `PATCH /api/v2/admin/applications/:id/status` — body `{ "status": "..." }`, validated against `APPLICATION_STATUS` enum (invalid → 400, missing id → 404).
- Added `ApplicationStatusUpdateSchema`, `ApplicationRepository.updateStatus`, `ApplicationService.updateApplicationStatus`, + 3 service tests.

**Reviewer permissions (criteria 3–5):**
- Decision: PMC execs all have `@ubcpmc.com` emails → **domain-based access**, no roles table. reviewer == admin (same access).
- `supabaseJwtCheck` now 403s any authenticated user whose email isn't `@ubcpmc.com` (domain configurable via `ADMIN_EMAIL_DOMAIN` env; leading `@` anchor rejects lookalikes). This secures the **whole** admin portal (users + events + applications), fixing the exposure flagged in PR #183.
- Added `tests/middleware/Session.test.ts` (5 cases: missing header, invalid token, non-exec email, lookalike domain, valid exec — case-insensitive).
- Also added a dummy `AUTH0_DOMAIN` in `tests/setup.ts` so importing `Session.ts` doesn't throw at load (CI's workflow doesn't set it either).

**Status:** all 5 acceptance criteria met. Full suite 91/91, build clean. Not yet committed/pushed — see below.

## Epic tickets (reference)
| # | Title | Assignee |
|---|-------|----------|
| [#162](https://github.com/UBC-Product-Management-Club/pmc-portal-be/issues/162) | Build applicant-facing recruiting form page | — |
| [#178](https://github.com/UBC-Product-Management-Club/pmc-portal-be/issues/178) | Add backend support for applicant statuses and reviewer permissions | Ege |
| [#177](https://github.com/UBC-Product-Management-Club/pmc-portal-be/issues/177) | Add backend endpoints for applicant submissions | Ege ✅ (PR #183) |
| [#175](https://github.com/UBC-Product-Management-Club/pmc-portal-be/issues/175) | Add backend endpoints for recruiting form management | youngconnorr |
| [#174](https://github.com/UBC-Product-Management-Club/pmc-portal-be/issues/174) | Add database schema for recruiting forms | youngconnorr |
| [#176](https://github.com/UBC-Product-Management-Club/pmc-portal-be/issues/176) | Add database schema for applicant submissions | youngconnorr ✅ (PR #183) |
| [#38](https://github.com/UBC-Product-Management-Club/pmc-portal-be/issues/38) | Add reviewer role-based access for applications | — |
| [#37](https://github.com/UBC-Product-Management-Club/pmc-portal-be/issues/37) | Add applicant status update controls | — |
| [#36](https://github.com/UBC-Product-Management-Club/pmc-portal-be/issues/36) | Build applicant detail view for reviewing submissions | — |
| [#35](https://github.com/UBC-Product-Management-Club/pmc-portal-be/issues/35) | Build applicant list view for recruiting dashboard | — |
| [#34](https://github.com/UBC-Product-Management-Club/pmc-portal-be/issues/34) | Build application form builder MVP | — |
| [#33](https://github.com/UBC-Product-Management-Club/pmc-portal-be/issues/33) | [TASK] Define recruiting dashboard product requirements | — |
| [#163](https://github.com/UBC-Product-Management-Club/pmc-portal-be/issues/163) | Add application submission confirmation state | — |
