-- Recruiting schema v2 -------------------------------------------------------
--
-- Four tables: Recruiting_Cycle, Recruiting_Role, Application, Admin_Allowlist.
--
-- The earlier draft split questions across three tables (Recruiting_Role_Form,
-- Recruiting_Role_Form_Question, Recruiting_General_Question). Those collapse
-- into jsonb question arrays here, matching how Event.event_form_questions
-- already works in this codebase. Unlike the events implementation, every
-- question carries a stable `key` -- events identify questions by label alone,
-- which makes answers impossible to match reliably once a label is reworded.
--
-- An application is a single row that starts as a draft and flips in place:
-- is_submitted = false means the applicant is still filling it out. That avoids
-- the Drafts-table pattern used for events, where the draft lives in a separate
-- table, is never cleared on submit, and cannot hold uploaded files.
--
-- This file is hand-run in the Supabase SQL Editor (staging first). It is
-- tracked in git purely so schema changes are PR-reviewable; there is no
-- Supabase CLI migration runner wired up for this project yet.
-- -----------------------------------------------------------------------------

-- Teardown -------------------------------------------------------------------
-- Full rebuild rather than an ALTER: this migration has never been merged, and
-- no real applications exist yet. Order matters -- dependents before their
-- parents. Also clears the two abandoned drafts from closed PRs (#181, #183/4).

drop view  if exists "Current_Cycle_Application";
drop table if exists "Application";
drop table if exists "Recruiting_Role_Form_Question";
drop table if exists "Recruiting_Role_Form";
drop table if exists "Recruiting_General_Question";
drop table if exists "Recruiting_Role";
drop table if exists "Admin_Allowlist";
drop table if exists "Recruiting_Cycle";
drop table if exists "Exec_Application";
drop table if exists "Recruiting";

drop type if exists "APPLICATION_STATUS";
drop type if exists "APPLICATION_CHOICE_RANK";
drop type if exists "RECRUITING_TEAM";
drop type if exists "ADMIN_ROLE";
drop type if exists "RECRUITING_FORM_STATUS";
-- QUESTION_TYPE is intentionally not recreated: questions live in jsonb now, so
-- no column uses it. The allowed types are enforced in zod instead.
drop type if exists "QUESTION_TYPE";

-- Enums ----------------------------------------------------------------------

-- Which team a role belongs to, so the applicant viewer can filter by team.
-- NOTE: PROGRAMS and EXDEV were added late -- confirm this list is right before
-- running, since adding values later is far more painful than editing it now.
create type "RECRUITING_TEAM" as enum (
  'TECH', 'MARKETING_MEDIA', 'MARKETING_DESIGN', 'EVENTS', 'PARTNERSHIPS',
  'COMMUNITY', 'FINANCE', 'LEADERSHIP', 'PROGRAMS', 'EXDEV'
);

-- Any exec on the allowlist may view every application and edit referral notes.
-- Only VP (and PRESIDENT) may change an application's status.
create type "ADMIN_ROLE" as enum ('PRESIDENT', 'VP', 'EXEC');

create type "APPLICATION_STATUS" as enum (
  'SUBMITTED', 'REVIEWED', 'WILL_REJECT', 'REJECTED_EMAIL_SENT',
  'INTERVIEW_INVITED', 'INTERVIEW_SCHEDULED', 'INTERVIEWED',
  'OFFER_SENT', 'OFFER_ACCEPTED', 'OFFER_DECLINED'
);

create type "APPLICATION_CHOICE_RANK" as enum (
  'FIRST', 'SECOND', 'THIRD_PLUS', 'ONLY'
);

-- Recruiting_Cycle -----------------------------------------------------------
-- One hiring round. Holds the general questions asked of every applicant
-- regardless of role, so they are edited in exactly one place.
--
-- Toggling is_active IS the open/close-applications feature flag; the partial
-- unique index below guarantees at most one cycle is ever open.

create table "Recruiting_Cycle" (
  cycle_id          uuid primary key default gen_random_uuid(),
  name              text not null,
  is_active         boolean not null default false,
  general_questions jsonb not null default '[]'::jsonb,
  opens_at          timestamptz,
  closes_at         timestamptz,
  created_at        timestamptz not null default now()
);

create unique index "Recruiting_Cycle_one_active_idx"
  on "Recruiting_Cycle" (is_active)
  where is_active;

alter table "Recruiting_Cycle" enable row level security;

-- Recruiting_Role ------------------------------------------------------------
-- One row per position per cycle, carrying that role's own questions. Roles are
-- cycle-scoped so questions can be reworded between rounds without rewriting
-- what past applicants actually answered.

create table "Recruiting_Role" (
  role_id    uuid primary key default gen_random_uuid(),
  cycle_id   uuid not null references "Recruiting_Cycle"(cycle_id) on delete cascade,
  name       text not null,
  team       "RECRUITING_TEAM" not null,
  questions  jsonb not null default '[]'::jsonb,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  unique (cycle_id, name),
  -- Redundant given role_id is already unique, but required as the target of
  -- Application's composite foreign key below.
  unique (cycle_id, role_id)
);

create index "Recruiting_Role_cycle_idx" on "Recruiting_Role" (cycle_id);

alter table "Recruiting_Role" enable row level security;

-- Application ----------------------------------------------------------------
-- One row per applicant per role, covering both drafts and submissions.
--
-- cycle_id is denormalised so the viewer can filter by cycle without a join,
-- but the composite foreign key to (cycle_id, role_id) makes it impossible for
-- it to disagree with the role's own cycle.

create table "Application" (
  application_id uuid primary key default gen_random_uuid(),
  user_id        text not null references "User"(user_id),
  cycle_id       uuid not null,
  role_id        uuid not null,

  -- Null while still a draft; required at submit time by the service layer.
  choice_rank    "APPLICATION_CHOICE_RANK",
  answers        jsonb not null default '{}'::jsonb,
  resume_url     text,

  -- Who the applicant says referred them (free text -- referrers are often
  -- execs without a User row, so this is deliberately not a foreign key).
  referred_by    text,

  -- Shared text boxes on the admin side. referral_notes is editable by any exec
  -- on the allowlist; general_notes by VPs. Both are single fields, so the last
  -- writer wins -- concurrent edits overwrite rather than merge.
  referral_notes text,
  general_notes  text,

  is_submitted   boolean not null default false,
  -- Only meaningful once is_submitted; drafts sit at the default.
  status         "APPLICATION_STATUS" not null default 'SUBMITTED',
  submitted_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- One application per person per role. role_id already implies the cycle, so
  -- re-applying to the same role in a later cycle is a different row.
  unique (user_id, role_id),

  foreign key (cycle_id, role_id)
    references "Recruiting_Role" (cycle_id, role_id),

  -- Keeps the draft flag and its timestamp from drifting apart.
  constraint "Application_submitted_at_matches_flag"
    check ((is_submitted and submitted_at is not null)
        or (not is_submitted and submitted_at is null))
);

create index "Application_status_idx"       on "Application" (status);
create index "Application_role_idx"         on "Application" (role_id);
create index "Application_cycle_idx"        on "Application" (cycle_id);
create index "Application_is_submitted_idx" on "Application" (is_submitted);

alter table "Application" enable row level security;

-- Admin_Allowlist ------------------------------------------------------------
-- Who may reach the admin portal at all, and what they may do there. Execs
-- manage this by editing rows in the Supabase table editor.
--
--   EXEC      -- view every application, edit referral notes
--   VP        -- the above, plus change application status
--   PRESIDENT -- same as VP today; separated so it can diverge later
--
-- team is which team the person belongs to. Unused by permissions right now
-- (any VP may act on any application) but recorded so per-team rules do not
-- need a migration later.

create table "Admin_Allowlist" (
  email      text primary key,
  role       "ADMIN_ROLE" not null default 'EXEC',
  team       "RECRUITING_TEAM",
  added_by   text references "User"(user_id),
  created_at timestamptz not null default now()
);

alter table "Admin_Allowlist" enable row level security;

-- Current_Cycle_Application --------------------------------------------------
-- Default target for the applicant viewer: only the open cycle's applications.
-- Past cycles fall out of the view once is_active flips, while staying fully
-- queryable on Application itself.

create view "Current_Cycle_Application" as
  select a.*
  from "Application" a
  join "Recruiting_Cycle" c on c.cycle_id = a.cycle_id
  where c.is_active;

-- Seed data ------------------------------------------------------------------
-- A starting cycle, left INACTIVE so it cannot accept applications by accident.
-- Flip is_active to open it. The general questions come from the real Spring
-- '26 hiring form; email is deliberately omitted since applicants are logged in
-- and their address is already on the User row.

insert into "Recruiting_Cycle" (name, is_active, general_questions) values (
  'Fall 2026 Exec Hiring',
  false,
  '[
    {"key":"first_name","label":"First Name","type":"SHORT_TEXT","options":null,"required":true,"max_words":null,"display_order":1},
    {"key":"last_name","label":"Last Name","type":"SHORT_TEXT","options":null,"required":true,"max_words":null,"display_order":2},
    {"key":"student_number","label":"Student Number","type":"SHORT_TEXT","options":null,"required":true,"max_words":null,"display_order":3},
    {"key":"how_found","label":"How did you find out about this opportunity?","type":"MULTI_SELECT","options":["Instagram","PMC Booth","LinkedIn","Word of Mouth","Previous PMC Events","PMC Newsletter","Other"],"required":true,"max_words":null,"display_order":4},
    {"key":"year","label":"What year will you be going into?","type":"SELECT","options":["Year 1","Year 2","Year 3","Year 4","Year 5+"],"required":true,"max_words":null,"display_order":5},
    {"key":"faculty","label":"Faculty","type":"SELECT","options":["Architecture","Arts","Applied Science","Sauder School of Business","Science","Land and Food Systems","Forestry"],"required":true,"max_words":null,"display_order":6},
    {"key":"major","label":"Major","type":"SHORT_TEXT","options":null,"required":true,"max_words":null,"display_order":7},
    {"key":"why_exec","label":"Why do you want to be an Exec at UBC PMC? What''s in it for you?","type":"LONG_TEXT","options":null,"required":true,"max_words":150,"display_order":8},
    {"key":"why_pm","label":"What makes you interested in Product Management, or the product space in general?","type":"LONG_TEXT","options":null,"required":true,"max_words":150,"display_order":9},
    {"key":"commitments","label":"Please elaborate on your commitments for the upcoming terms (course load, other clubs, in-person status).","type":"LONG_TEXT","options":null,"required":true,"max_words":null,"display_order":10},
    {"key":"resume","label":"Resume (PDF)","type":"FILE","options":null,"required":true,"max_words":null,"display_order":11},
    {"key":"linkedin","label":"Share your LinkedIn with us, if you would like!","type":"URL","options":null,"required":false,"max_words":null,"display_order":12},
    {"key":"anything_else","label":"Is there anything you would like us to know?","type":"LONG_TEXT","options":null,"required":false,"max_words":null,"display_order":13}
  ]'::jsonb
);

-- The 14 positions, attached to the seeded cycle. Team assignments are a best
-- guess from the role names -- adjust before opening applications.
insert into "Recruiting_Role" (cycle_id, name, team)
select c.cycle_id, r.name, r.team::"RECRUITING_TEAM"
from "Recruiting_Cycle" c
cross join (values
  ('VP Events',                   'EVENTS'),
  ('Events Director',             'EVENTS'),
  ('VP Community',                'COMMUNITY'),
  ('Community Director',          'COMMUNITY'),
  ('Design Director',             'MARKETING_DESIGN'),
  ('Marketing Director',          'MARKETING_MEDIA'),
  ('Media Director',              'MARKETING_MEDIA'),
  ('Finance Director',            'FINANCE'),
  ('Product Designer',            'TECH'),
  ('Developer',                   'TECH'),
  ('Corporate Outreach Director', 'PARTNERSHIPS'),
  ('Mentor Outreach Director',    'PARTNERSHIPS'),
  ('Program Director',            'PROGRAMS'),
  ('Program Outreach Director',   'PROGRAMS')
) as r(name, team)
where c.name = 'Fall 2026 Exec Hiring';

-- Developer's role-specific questions, seeded as a worked example of the
-- question shape the form builder should produce. Every other role starts with
-- an empty array.
update "Recruiting_Role"
set questions = '[
  {"key":"technical_project","label":"Tell us about a technical project where you chose a new technology -- the goal, why that tech, and the biggest hurdles.","type":"LONG_TEXT","options":null,"required":true,"max_words":150,"display_order":1},
  {"key":"tech_to_learn","label":"Is there a specific technology you are eager to learn more about? What excites you about it?","type":"LONG_TEXT","options":null,"required":true,"max_words":150,"display_order":2},
  {"key":"cpsc_courses","label":"Share some of the CPSC courses (or equivalent) you have taken at UBC.","type":"SHORT_TEXT","options":null,"required":false,"max_words":null,"display_order":3},
  {"key":"if_language","label":"If you could be a coding language, which one would it be and why?","type":"LONG_TEXT","options":null,"required":false,"max_words":null,"display_order":4},
  {"key":"portfolio_link","label":"Link to your work (Portfolio, Website, GitHub, etc.)","type":"URL","options":null,"required":true,"max_words":null,"display_order":5}
]'::jsonb
where name = 'Developer';
