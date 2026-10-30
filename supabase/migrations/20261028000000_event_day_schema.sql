-- Event day schema (PR 6) -------------------------------------------------------
--
-- The columns event day needs, so a new event is set up with rows, not code:
--
--   Event               Getting Ready content and Discord link (registered
--                       students only), team sizes, when finalists were
--                       published, and an optional sidebar icon
--   Team                finalist flag and a per-team deadline extension
--   Deliverable_Flags   the submission fields for each phase
--   Deliverable         a version for the stale-save check
--   Team_Member         one team per attendee, as a rule of the table
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
  add column if not exists discord_url text,
  -- Empty until tech publishes results after the on-stage reveal
  add column if not exists finalists_published_at timestamptz,
  -- Small square logo beside the event in the sidebar
  add column if not exists icon text;

alter table "Event" drop constraint if exists event_team_size_check;
alter table "Event" add constraint event_team_size_check
  check (min_team_size >= 1 and max_team_size >= min_team_size);

alter table "Event" drop constraint if exists event_discord_url_check;
alter table "Event" add constraint event_discord_url_check
  check (discord_url is null or discord_url ~ '^https://');

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

-- Team_Member's key is (team_id, attendee_id), which lets one attendee sit on two
-- teams. If this fails, find them first with:
--   select attendee_id, count(*) from "Team_Member" group by 1 having count(*) > 1;
do $$ begin
  if exists (select 1 from "Team_Member" group by attendee_id having count(*) > 1) then
    raise exception 'Some attendees are on more than one team; fix them before running this migration';
  end if;
end $$;
create unique index if not exists team_member_attendee_key on "Team_Member" (attendee_id);
