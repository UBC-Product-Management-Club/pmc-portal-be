-- Recruiting schema (clean redesign) -----------------------------------------
--
-- Replaces the earlier Exec_Application draft entirely. Every application is a
-- filled-out role form: shared general questions (edited in exactly one place)
-- + that role's specific questions. Only one hiring cycle is ever open at a
-- time; older cycles' applications are preserved but hidden from the default
-- admin view via Current_Cycle_Application.
--
-- This file is hand-run in the Supabase SQL Editor (staging first). It is
-- tracked in git purely so schema changes are PR-reviewable; there is no
-- Supabase CLI migration runner wired up for this project yet.
-- -----------------------------------------------------------------------------

-- Clean up superseded drafts (staging only -- prod never had these tables).
-- Exec_Application/APPLICATION_STATUS: the earlier applicant-submission draft
-- from PRs #183/#184 (closed). Recruiting/RECRUITING_FORM_STATUS: the
-- independent form-schema draft from PR #181 (closed, #174/#175).
drop view if exists "Current_Cycle_Application";
drop table if exists "Exec_Application";
drop type if exists "APPLICATION_STATUS";
drop table if exists "Recruiting";
drop type if exists "RECRUITING_FORM_STATUS";

-- Enums -----------------------------------------------------------------------

create type "QUESTION_TYPE" as enum (
  'SHORT_TEXT', 'LONG_TEXT', 'SELECT', 'MULTI_SELECT', 'FILE', 'URL'
);

create type "APPLICATION_STATUS" as enum (
  'SUBMITTED', 'REVIEWED', 'WILL_REJECT', 'REJECTED_EMAIL_SENT',
  'INTERVIEW_INVITED', 'INTERVIEW_SCHEDULED', 'INTERVIEWED',
  'OFFER_SENT', 'OFFER_ACCEPTED', 'OFFER_DECLINED'
);

create type "APPLICATION_CHOICE_RANK" as enum (
  'FIRST', 'SECOND', 'THIRD_PLUS', 'ONLY'
);

-- Recruiting_Cycle --------------------------------------------------------
-- Reuse the existing table as-is; only one cycle may be active at a time.
-- Toggling is_active IS the "open/close applications" feature flag -- no
-- separate flag needed.

create unique index if not exists "Recruiting_Cycle_one_active_idx"
  on "Recruiting_Cycle" (is_active)
  where is_active;

-- Recruiting_Role ---------------------------------------------------------
-- Static catalog of the 14 exec positions. Prefixed to avoid confusion with
-- the unrelated lowercase "roles" table (Slack birthdays).

create table "Recruiting_Role" (
  role_id    uuid primary key default gen_random_uuid(),
  name       text not null unique,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

alter table "Recruiting_Role" enable row level security;

-- Recruiting_Role_Form ------------------------------------------------------
-- One cycle-scoped instance per role -- the "14 independent forms".

create table "Recruiting_Role_Form" (
  role_form_id uuid primary key default gen_random_uuid(),
  cycle_id     uuid not null references "Recruiting_Cycle"(cycle_id),
  role_id      uuid not null references "Recruiting_Role"(role_id),
  created_at   timestamptz not null default now(),
  unique (cycle_id, role_id)
);

alter table "Recruiting_Role_Form" enable row level security;

-- Recruiting_Role_Form_Question ---------------------------------------------
-- Role-specific questions, one row per question so a form builder can add /
-- edit / reorder / delete individually. Portfolio link (URL) goes here, only
-- on the roles that need it.

create table "Recruiting_Role_Form_Question" (
  question_id   uuid primary key default gen_random_uuid(),
  role_form_id  uuid not null references "Recruiting_Role_Form"(role_form_id) on delete cascade,
  key           text not null,
  label         text not null,
  type          "QUESTION_TYPE" not null,
  options       text[],
  is_required   boolean not null default true,
  max_words     integer,
  display_order integer not null,
  unique (role_form_id, key)
);

alter table "Recruiting_Role_Form_Question" enable row level security;

-- Recruiting_General_Question ------------------------------------------------
-- The single shared question set asked on every application regardless of
-- role, edited in exactly one place. NOT cycle-scoped. Resume lives here
-- (FILE, required for everyone).

create table "Recruiting_General_Question" (
  question_id   uuid primary key default gen_random_uuid(),
  key           text not null unique,
  label         text not null,
  type          "QUESTION_TYPE" not null,
  options       text[],
  is_required   boolean not null default true,
  max_words     integer,
  display_order integer not null
);

alter table "Recruiting_General_Question" enable row level security;

-- Application ---------------------------------------------------------------
-- One row per applicant per role per cycle. role_form_id transitively carries
-- both the role and the cycle, so unique(user_id, role_form_id) blocks a
-- duplicate application to the same role in the same cycle while still
-- allowing re-application to the same role in a later cycle (a different
-- role_form_id). choice_rank is structural metadata about the application
-- (which preference this submission represents), not form content, so it is
-- a column rather than a question.

create table "Application" (
  application_id uuid primary key default gen_random_uuid(),
  user_id        text not null references "User"(user_id),
  role_form_id   uuid not null references "Recruiting_Role_Form"(role_form_id),
  choice_rank    "APPLICATION_CHOICE_RANK" not null,
  -- General + role answers keyed by each question's `key`. FILE-type answers
  -- store the uploaded file's storage URL, like any other answer value.
  answers        jsonb not null,
  status         "APPLICATION_STATUS" not null default 'SUBMITTED',
  submitted_at   timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, role_form_id)
);

create index "Application_status_idx" on "Application"(status);

alter table "Application" enable row level security;

-- Admin_Allowlist -------------------------------------------------------------
-- Replaces the old "@ubcpmc.com email domain" middleware check entirely as
-- the admin-portal access gate. Enforcement logic is separate follow-up work;
-- this is the table it will read from.

create table "Admin_Allowlist" (
  email      text primary key,
  added_by   text references "User"(user_id),
  created_at timestamptz not null default now()
);

alter table "Admin_Allowlist" enable row level security;

-- Current_Cycle_Application view ---------------------------------------------
-- Default admin-viewer query target: only the active cycle's applications.
-- No soft-delete/archival column needed -- old cycles simply fall out of this
-- view once is_active flips false, while remaining queryable on Application.

create view "Current_Cycle_Application" as
  select a.*
  from "Application" a
  join "Recruiting_Role_Form" rf on rf.role_form_id = a.role_form_id
  join "Recruiting_Cycle" rc on rc.cycle_id = rf.cycle_id
  where rc.is_active;

-- Seed data -------------------------------------------------------------------
-- Only genuinely static reference data. No cycle or role-form rows are
-- seeded, so nothing here could be mistaken for live operational data.

insert into "Recruiting_Role" (name) values
  ('VP Events'),
  ('Events Director'),
  ('VP Community'),
  ('Community Director'),
  ('Design Director'),
  ('Marketing Director'),
  ('Media Director'),
  ('Finance Director'),
  ('Product Designer'),
  ('Developer'),
  ('Corporate Outreach Director'),
  ('Mentor Outreach Director'),
  ('Program Director'),
  ('Program Outreach Director');

insert into "Recruiting_General_Question"
  (key, label, type, options, is_required, max_words, display_order) values
  ('first_name', 'First Name', 'SHORT_TEXT', null, true, null, 1),
  ('last_name', 'Last Name', 'SHORT_TEXT', null, true, null, 2),
  ('student_number', 'Student Number', 'SHORT_TEXT', null, true, null, 3),
  ('how_found', 'How did you find out about this opportunity?', 'MULTI_SELECT',
    array['Instagram', 'PMC Booth', 'LinkedIn', 'Word of Mouth', 'Previous PMC Events', 'PMC Newsletter', 'Other'],
    true, null, 4),
  ('year', 'What year will you be going into?', 'SELECT',
    array['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5+'], true, null, 5),
  ('faculty', 'Faculty', 'SELECT',
    array['Architecture', 'Arts', 'Applied Science', 'Sauder School of Business', 'Science', 'Land and Food Systems', 'Forestry'],
    true, null, 6),
  ('major', 'Major', 'SHORT_TEXT', null, true, null, 7),
  ('why_exec', 'Why do you want to be an Exec at UBC PMC? What''s in it for you?', 'LONG_TEXT', null, true, 150, 8),
  ('why_pm', 'What makes you interested in Product Management, or the product space in general?', 'LONG_TEXT', null, true, 150, 9),
  ('commitments', 'Please elaborate on your commitments for the upcoming terms (course load, other clubs, in-person status).', 'LONG_TEXT', null, true, null, 10),
  ('resume', 'Resume (PDF)', 'FILE', null, true, null, 11),
  ('linkedin', 'Share your LinkedIn with us, if you would like!', 'URL', null, false, null, 12),
  ('anything_else', 'Is there anything you would like us to know?', 'LONG_TEXT', null, false, null, 13);
