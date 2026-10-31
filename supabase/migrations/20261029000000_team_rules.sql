-- Team rules (PR 7) ------------------------------------------------------------
--
-- Creating, joining, leaving and renaming a team, each in one function so every
-- rule is checked in the same transaction as the write:
--
--   only Registered attendees, one team each, at most max_team_size members
--   team names are unique in an event, ignoring case
--   codes are one letter (not I or O) and four digits, e.g. R4827
--   joining and leaving stop at the roster lock (TEAM_CHANGES_CLOSED) or once
--   the team has a submission (ROSTER_LOCKED); extensions never reopen them
--   a student with no team can still create one (a team of one) until the
--   submission deadline, so nobody is left unable to submit
--   any member can rename until the team's deadline, extension included
--
-- Every change locks the event's row first, so "already on a team" and "name
-- taken" are checked one request at a time. Joining and leaving also lock the
-- team's row, which saving a submission takes too, so nobody joins a team while
-- its submission is being saved. These are rules of the functions rather than
-- unique indexes because production has past events that break them.
--
-- Errors are raised by name and the API sends them back as the code:
-- NOT_REGISTERED, NOT_ON_TEAM, ALREADY_ON_TEAM, NOT_FOUND, TEAM_FULL,
-- ROSTER_LOCKED, TEAM_CHANGES_CLOSED, CLOSED, TEAM_NAME_TAKEN, INVALID_TEAM_NAME.
--
-- Hand-run in the Supabase SQL Editor (staging first), after
-- 20261028000000_event_day_schema.sql. Safe to re-run.
-- -----------------------------------------------------------------------------

-- Deadlines --------------------------------------------------------------------

-- When joining and leaving stop: Event.roster_locks_at, or 24 hours after the
-- submission window opens. Null (no phase yet) means the roster is open.
create or replace function team_roster_closes(p_event_id uuid)
returns timestamptz language sql stable as $$
  select coalesce(e.roster_locks_at,
                  (select min(starttime) from "Deliverable_Flags" where event_id = e.event_id) + interval '24 hours')
  from "Event" e where e.event_id = p_event_id;
$$;

-- The latest phase deadline; extend_phase_deadline moves it
create or replace function event_submission_deadline(p_event_id uuid)
returns timestamptz language sql stable as $$
  select max(deadline) from "Deliverable_Flags" where event_id = p_event_id;
$$;

-- Who's who ----------------------------------------------------------------------

-- How a student appears to teammates and organizers: the name and email from
-- their application for this event, or their profile when those are missing
create or replace function applicant_name(p_attendee "Attendee", p_user "User")
returns text language sql immutable as $$
  select coalesce(nullif(btrim(p_attendee.event_form_answers->>'name'), ''), btrim(p_user.first_name || ' ' || p_user.last_name));
$$;

create or replace function applicant_email(p_attendee "Attendee", p_user "User")
returns text language sql immutable as $$
  select coalesce(nullif(btrim(p_attendee.event_form_answers->>'email'), ''), p_user.email);
$$;

-- The caller's attendee row if they're Registered, or NOT_REGISTERED
create or replace function registered_attendee(p_event_id uuid, p_user_id "Attendee".user_id%type)
returns "Attendee" language plpgsql stable as $$
declare v_attendee "Attendee";
begin
  select * into v_attendee from "Attendee" where event_id = p_event_id and user_id = p_user_id;
  if v_attendee.status is distinct from 'REGISTERED' then
    raise exception 'NOT_REGISTERED';
  end if;
  return v_attendee;
end $$;

-- The registered caller's team id, or NOT_ON_TEAM
create or replace function member_team_id(p_event_id uuid, p_user_id "Attendee".user_id%type)
returns uuid language plpgsql stable as $$
declare v_team_id uuid;
begin
  select team_id into v_team_id from "Team_Member"
  where attendee_id = (registered_attendee(p_event_id, p_user_id)).attendee_id;
  if v_team_id is null then
    raise exception 'NOT_ON_TEAM';
  end if;
  return v_team_id;
end $$;

-- What students see ------------------------------------------------------------

-- The team in the shape the portal reads: names and emails from applicant_name
-- and applicant_email, never the phone number. is_finalist is left out until
-- results are published.
create or replace function team_view(p_team_id uuid)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'team_id', t.team_id,
    'Team', jsonb_build_object(
      'team_name', t.team_name,
      'team_code', t.team_code,
      'Team_Member', coalesce((
        select jsonb_agg(jsonb_build_object(
          'attendee_id', a.attendee_id,
          'Attendee', jsonb_build_object(
            'user_id', a.user_id,
            -- The portal shows "first_name last_name", so split the full name at its first space
            'User', jsonb_build_object(
              'first_name', split_part(applicant_name(a, u), ' ', 1),
              'last_name', btrim(substr(applicant_name(a, u), length(split_part(applicant_name(a, u), ' ', 1)) + 1)),
              'email', applicant_email(a, u)))
        ) order by a.created_at)
        from "Team_Member" m
        join "Attendee" a on a.attendee_id = m.attendee_id
        join "User" u on u.user_id = a.user_id
        where m.team_id = t.team_id), '[]'::jsonb)
    ) || case when e.finalists_published_at <= now()
              then jsonb_build_object('is_finalist', t.is_finalist) else '{}'::jsonb end
  )
  from "Team" t join "Event" e on e.event_id = t.event_id
  where t.team_id = p_team_id;
$$;

create or replace function my_team(p_event_id uuid, p_user_id "Attendee".user_id%type)
returns jsonb language sql stable as $$
  select team_view(member_team_id(p_event_id, p_user_id));
$$;

-- Changes ------------------------------------------------------------------------

-- Trimmed, 1 to 80 characters, no control characters
create or replace function clean_team_name(p_name text)
returns text language plpgsql immutable as $$
declare v_name text := btrim(coalesce(p_name, ''));
begin
  if char_length(v_name) not between 1 and 80 or v_name ~ '[[:cntrl:]]' then
    raise exception 'INVALID_TEAM_NAME';
  end if;
  return v_name;
end $$;

-- Locks the event's row so team changes in it run one at a time
create or replace function lock_event_teams(p_event_id uuid)
returns void language sql as $$
  select 1 from "Event" where event_id = p_event_id for update;
$$;

-- Raises TEAM_NAME_TAKEN if another team in the event has this name, ignoring case
create or replace function check_team_name_free(p_event_id uuid, p_name text, p_team_id uuid default null)
returns void language plpgsql stable as $$
begin
  if exists (select 1 from "Team" where event_id = p_event_id and lower(team_name) = lower(p_name)
             and team_id is distinct from p_team_id) then
    raise exception 'TEAM_NAME_TAKEN';
  end if;
end $$;

create or replace function create_team(p_event_id uuid, p_user_id "Attendee".user_id%type, p_team_name text)
returns jsonb language plpgsql as $$
declare
  v_name text := clean_team_name(p_team_name);
  v_attendee "Attendee";
  v_team_id uuid;
  v_constraint text;
begin
  perform lock_event_teams(p_event_id);
  v_attendee := registered_attendee(p_event_id, p_user_id);
  if exists (select 1 from "Team_Member" where attendee_id = v_attendee.attendee_id) then
    raise exception 'ALREADY_ON_TEAM';
  end if;
  -- After the roster lock this can only ever be a team of one, since nobody can join
  if now() >= event_submission_deadline(p_event_id) then
    raise exception 'CLOSED';
  end if;
  perform check_team_name_free(p_event_id, v_name);

  -- 240,000 possible codes; on the rare clash, draw again
  for attempt in 1..20 loop
    begin
      insert into "Team" (event_id, team_name, team_code)
      values (p_event_id, v_name,
              substr('ABCDEFGHJKLMNPQRSTUVWXYZ', 1 + floor(random() * 24)::int, 1)
                || lpad(floor(random() * 10000)::int::text, 4, '0'))
      returning team_id into v_team_id;
      exit;
    exception when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint <> 'Team_team_code_key' then
        raise exception 'TEAM_NAME_TAKEN';
      end if;
    end;
  end loop;
  if v_team_id is null then
    raise exception 'Could not find a free team code';
  end if;

  insert into "Team_Member" (team_id, attendee_id) values (v_team_id, v_attendee.attendee_id);
  return team_view(v_team_id);
end $$;

-- p_team_code is normalized here: spaces dropped, upper-cased
create or replace function join_team(p_event_id uuid, p_user_id "Attendee".user_id%type, p_team_code text)
returns jsonb language plpgsql as $$
declare
  v_attendee "Attendee";
  v_team "Team";
begin
  perform lock_event_teams(p_event_id);
  v_attendee := registered_attendee(p_event_id, p_user_id);
  if exists (select 1 from "Team_Member" where attendee_id = v_attendee.attendee_id) then
    raise exception 'ALREADY_ON_TEAM';
  end if;

  select * into v_team from "Team"
  where event_id = p_event_id and team_code = upper(regexp_replace(coalesce(p_team_code, ''), '\s', '', 'g'))
  for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;

  if now() >= team_roster_closes(p_event_id) then
    raise exception 'TEAM_CHANGES_CLOSED';
  end if;
  if exists (select 1 from "Deliverable" where team_id = v_team.team_id) then
    raise exception 'ROSTER_LOCKED';
  end if;
  if (select count(*) from "Team_Member" where team_id = v_team.team_id)
     >= (select max_team_size from "Event" where event_id = p_event_id) then
    raise exception 'TEAM_FULL';
  end if;

  insert into "Team_Member" (team_id, attendee_id) values (v_team.team_id, v_attendee.attendee_id);
  return team_view(v_team.team_id);
end $$;

-- The last member to leave deletes the team
create or replace function leave_team(p_event_id uuid, p_user_id "Attendee".user_id%type)
returns void language plpgsql as $$
declare
  v_attendee "Attendee";
  v_team_id uuid;
begin
  perform lock_event_teams(p_event_id);
  v_attendee := registered_attendee(p_event_id, p_user_id);
  v_team_id := member_team_id(p_event_id, p_user_id);
  perform 1 from "Team" where team_id = v_team_id for update;

  if now() >= team_roster_closes(p_event_id) then
    raise exception 'TEAM_CHANGES_CLOSED';
  end if;
  if exists (select 1 from "Deliverable" where team_id = v_team_id) then
    raise exception 'ROSTER_LOCKED';
  end if;

  delete from "Team_Member" where team_id = v_team_id and attendee_id = v_attendee.attendee_id;
  delete from "Team" t where t.team_id = v_team_id
    and not exists (select 1 from "Team_Member" m where m.team_id = t.team_id);
end $$;

create or replace function rename_team(p_event_id uuid, p_user_id "Attendee".user_id%type, p_team_name text)
returns jsonb language plpgsql as $$
declare
  v_name text := clean_team_name(p_team_name);
  v_team_id uuid;
begin
  perform lock_event_teams(p_event_id);
  v_team_id := member_team_id(p_event_id, p_user_id);
  -- Until the team's deadline, extension included (greatest ignores nulls)
  if now() >= (select greatest(event_submission_deadline(p_event_id), extended_until) from "Team" where team_id = v_team_id) then
    raise exception 'CLOSED';
  end if;
  perform check_team_name_free(p_event_id, v_name, v_team_id);

  update "Team" set team_name = v_name where team_id = v_team_id;
  return team_view(v_team_id);
end $$;

-- Access ---------------------------------------------------------------------------

-- Only the API (service role) may call these
revoke execute on function team_roster_closes from public, anon, authenticated;
revoke execute on function event_submission_deadline from public, anon, authenticated;
revoke execute on function applicant_name from public, anon, authenticated;
revoke execute on function applicant_email from public, anon, authenticated;
revoke execute on function registered_attendee from public, anon, authenticated;
revoke execute on function member_team_id from public, anon, authenticated;
revoke execute on function team_view from public, anon, authenticated;
revoke execute on function my_team from public, anon, authenticated;
revoke execute on function clean_team_name from public, anon, authenticated;
revoke execute on function lock_event_teams from public, anon, authenticated;
revoke execute on function check_team_name_free from public, anon, authenticated;
revoke execute on function create_team from public, anon, authenticated;
revoke execute on function join_team from public, anon, authenticated;
revoke execute on function leave_team from public, anon, authenticated;
revoke execute on function rename_team from public, anon, authenticated;
grant execute on function team_roster_closes to service_role;
grant execute on function event_submission_deadline to service_role;
grant execute on function applicant_name to service_role;
grant execute on function applicant_email to service_role;
grant execute on function registered_attendee to service_role;
grant execute on function member_team_id to service_role;
grant execute on function team_view to service_role;
grant execute on function my_team to service_role;
grant execute on function clean_team_name to service_role;
grant execute on function lock_event_teams to service_role;
grant execute on function check_team_name_free to service_role;
grant execute on function create_team to service_role;
grant execute on function join_team to service_role;
grant execute on function leave_team to service_role;
grant execute on function rename_team to service_role;
