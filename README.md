# PMC Portal Backend

Express + TypeScript API for the PMC member portal. Data and files live in
Supabase, payments go through Stripe Checkout, and email through Loops. The
rules for each event flow are in the Event Portal design spec; the database
functions in `supabase/migrations/` are where most of them are enforced.

## Running it

```sh
npm install
npm start            # needs .secret/.env (below)
npm test             # Jest; repositories are mocked
npm run test:sql     # runs the migrations in an in-process Postgres (PGlite)
npm run build
```

## Environment

Backend only, in `.secret/.env` locally and in Cloud Run for staging and
production. Never commit them.

| Variable | What it's for |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Database and storage (service role) |
| `SUPABASE_ATTENDEE_BUCKET_NAME` | Private bucket for application files (resumes) |
| `SUPABASE_DELIVERABLES_BUCKET` | Private bucket for submission files (decks) |
| `SUPABASE_BUCKET_NAME` | Public bucket for event images |
| `AUTH0_DOMAIN`, `JWT_AUDIENCE` | Student login |
| `STRIPE_SECRET`, `STRIPE_WEBHOOK_SECRET` | Checkout and the `/webhook` endpoint |
| `LOOPS_API_KEY` | Loops (signup, membership and mailing-list calls) |
| `EMAIL_DELIVERY_ENABLED` | `false` until the four event email templates are real |
| `LOOPS_APPLICATION_RECEIVED_ID`, `LOOPS_ACCEPTED_ID`, `LOOPS_REJECTED_ID`, `LOOPS_REMINDER_ID` | The event email templates |
| `ORIGIN`, `ADMIN_PORTAL_ORIGIN`, `PORT` | CORS and port |
| `REVIEW_SHEET_ID`, `GOOGLE_APPLICATION_CREDENTIALS`, `OPS_EVENT_ID`, `OPS_SHEET_EDITORS` | Only for the ops scripts, on the machine that runs them |

## Migrations

SQL files in `supabase/migrations/`, run by hand in the Supabase SQL Editor,
staging first, in filename order. Each is safe to re-run. Read the header of
each file before running it; some have a step to run on its own.

| File | Adds |
| --- | --- |
| `20261025000000_register_checks.sql` | Window, duplicate and seat checks on applications |
| `20261026000000_applicant_review.sql` | Review decisions, the payment hold, notification hooks, checkout fulfilment |
| `20261027000000_ops_tooling.sql` | Review sheet, messages and payment issue queries |
| `20261028000000_event_day_schema.sql` | Event day columns; one team per attendee |
| `20261029000000_team_rules.sql` | Create, join, leave and rename teams |
| `20261030000000_submissions.sql` | The submission window and stale-save check |
| `20261031000000_event_day_ops.sql` | Extensions, finalists and the submission export |
| `20261101000000_home.sql` | Announcements and Home statuses |

After running one, regenerate `src/schema/v2/database.types.ts` with
`scripts/gen_types.sh`.

## Setting up a new event

No code changes; everything is rows.

1. **Stripe:** create a member and a non-member price (CAD).
2. **Event row:** name, blurb, description (markdown), start and end times,
   location, `member_price_id` / `non_member_price_id`, `needs_review`,
   `registration_opens` / `registration_closes`, `max_attendees` (student
   seats), `payment_hold_hours`, `schedule`, and `event_form_questions` in the
   format below. Name and email are fixed fields on every form.
3. **Event day:** `min_team_size`, `max_team_size`, `discord_url`, `icon`, and
   `page_content`:
   ```json
   { "mentors": [{ "name": "", "role": "", "photo": "https://…", "link": "https://…" }],
     "prep": ["Bring your laptop"],
     "faq": [{ "q": "", "a": "" }] }
   ```
4. **Submission phase:** one `Deliverable_Flags` row with `starttime`,
   `deadline`, `is_enabled` and `fields`. Make the schedule's submission
   deadline the same time as `deadline`.

Questions and submission fields share one format. `maxWords`, `accept` and
`maxSizeMB` are optional; sizes are decimal (5 MB = 5,000,000 bytes).

```json
[
  { "id": "why_event", "type": "long-answer", "label": "Why this event?", "required": true, "maxWords": 300 },
  { "id": "resume", "type": "file", "label": "Resume (PDF)", "required": true, "accept": ["application/pdf"], "maxSizeMB": 5 },
  { "id": "prototype", "type": "url", "label": "Prototype / demo link", "required": true }
]
```

Types: `short-answer`, `long-answer`, `dropdown`, `radio`, `checkbox`, `file`
and `url` (https only, up to 2,048 characters). A question with id `phone` is
checked as a North American number.

## Ops scripts

Tech runs organizer steps with `npm run ops -- <command>`; the full list is at
the top of `src/ops/cli.ts`. Decisions, extensions and finalists only go through
the database functions, never by editing rows.

```sh
npm run ops -- sync --event <id>                          # review sheet
npm run ops -- decide --event <id> --by <name> [--apply]
npm run ops -- extend --event <id> --until 2026-11-22T12:15:00-08:00 [--team R4827]
npm run ops -- finalists --event <id> --mark R4827,K1093
npm run ops -- publish-finalists --event <id> --confirm R4827,K1093
npm run ops -- export-submissions --event <id> --out ./exports
```

The review sheet and the full submissions CSV hold personal data: share them
only with organizers and delete them after the event.

## Contributors

- Gordon Cheung
- Toby Lau
- Karen Agustino
