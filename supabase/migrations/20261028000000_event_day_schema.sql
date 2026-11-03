-- Event day schema (PR 6) -------------------------------------------------------
--
-- The columns event day needs, so a new event is set up with rows, not code:
--
--   Event               Getting Ready content and Slack link (registered
--                       students only), team sizes, when finalists were
--                       published, and an optional sidebar icon
--   Team                finalist flag and a per-team deadline extension
--   Deliverable_Flags   the submission fields for each phase
--   Deliverable         a version for the stale-save check
--
-- Hand-run in the Supabase SQL Editor (staging first), after
-- 20261027000000_ops_tooling.sql. Safe to re-run.
-- -----------------------------------------------------------------------------

alter table "Event"
  -- Mentors, prep checklist and FAQ; never in the public event response
  add column if not exists page_content jsonb,
  add column if not exists min_team_size int not null default 1,
  add column if not exists max_team_size int not null default 4,
  -- Registered students only, like page_content
  add column if not exists slack_url text,
  -- Empty until tech publishes results after the on-stage reveal
  add column if not exists finalists_published_at timestamptz,
  -- Small square logo beside the event in the sidebar
  add column if not exists icon text,
  -- When creating, joining and leaving teams stops. Empty means 24 hours after
  -- the submission window opens. Extensions never move it.
  add column if not exists roster_locks_at timestamptz;

alter table "Event" drop constraint if exists event_team_size_check;
alter table "Event" add constraint event_team_size_check
  check (min_team_size >= 1 and max_team_size >= min_team_size);

alter table "Event" drop constraint if exists event_slack_url_check;
alter table "Event" add constraint event_slack_url_check
  check (slack_url is null or slack_url ~ '^https://');

alter table "Team"
  -- Hidden from students until Event.finalists_published_at
  add column if not exists is_finalist boolean not null default false,
  -- One team's extension; the later of this and the phase deadline applies
  add column if not exists extended_until timestamptz;

alter table "Deliverable_Flags"
  -- Same format as application questions, plus the url type
  add column if not exists fields jsonb not null default '[]'::jsonb;

alter table "Deliverable"
  -- Goes up by one on every save; a save that sends an old version is STALE
  add column if not exists version int not null default 0;
