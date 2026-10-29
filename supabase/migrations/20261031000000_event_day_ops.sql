-- Event day ops (PR 11) ----------------------------------------------------------
--
-- What tech runs on event day when the events team asks (4.5, Event day), so
-- nobody edits these rows by hand:
--
--   extend_phase_deadline   every team; once the window has opened it only moves later
--   extend_team             one team; only ever later
--   set_finalists           mark or unmark teams by code, all or nothing; refused
--                           after publishing unless it's an explicit correction
--   publish_finalists       sets finalists_published_at, but only if the finalist
--                           list is exactly the one read back to the events team
--   submission_export       one row per team for a phase, for the CSV
--
-- Errors are raised by name: NOT_FOUND, UNKNOWN_TEAM, FINALISTS_PUBLISHED,
-- FINALISTS_CHANGED.
--
-- Hand-run in the Supabase SQL Editor (staging first), after
-- 20261030000000_submissions.sql. Safe to re-run.
-- -----------------------------------------------------------------------------

-- Returns the phase's deadline afterwards. Before the window opens the deadline
-- can be set freely; after, greatest() keeps two extensions at once from moving
-- it earlier.
create or replace function extend_phase_deadline(p_phase_id uuid, p_until timestamptz)
returns timestamptz language plpgsql as $$
declare v_deadline timestamptz;
begin
  perform 1 from "Deliverable_Flags" where id = p_phase_id for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  update "Deliverable_Flags"
  set deadline = case when starttime is null or now() >= starttime then greatest(deadline, p_until) else p_until end
  where id = p_phase_id
  returning deadline into v_deadline;
  return v_deadline;
end $$;

-- Returns the team's extension afterwards
create or replace function extend_team(p_event_id uuid, p_team_code text, p_until timestamptz)
returns timestamptz language plpgsql as $$
declare v_until timestamptz;
begin
  update "Team" set extended_until = greatest(extended_until, p_until)
  where event_id = p_event_id and team_code = upper(btrim(p_team_code))
  returning extended_until into v_until;
  if not found then
    raise exception 'UNKNOWN_TEAM: %', p_team_code;
  end if;
  return v_until;
end $$;

-- Returns how many teams changed
create or replace function set_finalists(
  p_event_id uuid,
  p_team_codes text[],
  p_is_finalist boolean,
  p_correction boolean default false
)
returns int language plpgsql as $$
declare v_published timestamptz; v_codes text[]; v_missing text[]; v_done int;
begin
  select finalists_published_at into v_published from "Event" where event_id = p_event_id for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if v_published is not null and not p_correction then
    raise exception 'FINALISTS_PUBLISHED';
  end if;

  select array_agg(distinct upper(btrim(c))) into v_codes from unnest(p_team_codes) c;
  select array_agg(c) into v_missing from unnest(v_codes) c
  where not exists (select 1 from "Team" t where t.event_id = p_event_id and t.team_code = c);
  if v_missing is not null then
    raise exception 'UNKNOWN_TEAM: %', array_to_string(v_missing, ', ');
  end if;

  update "Team" set is_finalist = p_is_finalist
  where event_id = p_event_id and team_code = any(v_codes) and is_finalist <> p_is_finalist;
  get diagnostics v_done = row_count;
  return v_done;
end $$;

-- p_team_codes is the list the events team OK'd. Students see results the
-- moment this commits, so it refuses if the marked list differs at all.
create or replace function publish_finalists(p_event_id uuid, p_team_codes text[])
returns timestamptz language plpgsql as $$
declare v_published timestamptz; v_marked text[]; v_confirmed text[];
begin
  select finalists_published_at into v_published from "Event" where event_id = p_event_id for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if v_published is not null then
    raise exception 'FINALISTS_PUBLISHED';
  end if;

  select coalesce(array_agg(team_code order by team_code), '{}') into v_marked
  from "Team" where event_id = p_event_id and is_finalist;
  select coalesce(array_agg(distinct upper(btrim(c)) order by upper(btrim(c))), '{}') into v_confirmed
  from unnest(p_team_codes) c;
  if v_marked <> v_confirmed then
    raise exception 'FINALISTS_CHANGED: marked %', array_to_string(v_marked, ', ');
  end if;

  update "Event" set finalists_published_at = now() where event_id = p_event_id
  returning finalists_published_at into v_published;
  return v_published;
end $$;

-- One row per team in the phase's event, submitted or not. File answers stay as
-- private paths; the script swaps them for signed links.
create or replace function submission_export(p_phase_id uuid)
returns table (
  team_id uuid,
  team_code text,
  team_name text,
  team_size int,
  member_names text[],
  member_emails text[],
  is_finalist boolean,
  submitted_at timestamptz,
  submitted_by text,
  version int,
  effective_deadline timestamptz,
  submission jsonb,
  fields jsonb
)
language sql stable as $$
  select t.team_id, t.team_code, t.team_name,
         (select count(*)::int from "Team_Member" m where m.team_id = t.team_id),
         array(select applicant_name(a, u)
               from "Team_Member" m join "Attendee" a on a.attendee_id = m.attendee_id join "User" u on u.user_id = a.user_id
               where m.team_id = t.team_id order by a.created_at),
         array(select applicant_email(a, u)
               from "Team_Member" m join "Attendee" a on a.attendee_id = m.attendee_id join "User" u on u.user_id = a.user_id
               where m.team_id = t.team_id order by a.created_at),
         t.is_finalist,
         d.submitted_at,
         (select applicant_name(a, u)
          from "User" u left join "Attendee" a on a.user_id = u.user_id and a.event_id = t.event_id
          where u.user_id = d.submitted_by),
         d.version,
         greatest(f.deadline, t.extended_until),
         d.submission,
         f.fields
  from "Deliverable_Flags" f
  join "Team" t on t.event_id = f.event_id
  left join "Deliverable" d on d.team_id = t.team_id and d.phase_id = f.id::text
  where f.id = p_phase_id
  order by t.team_name;
$$;

-- Only tech's scripts (service role) may call these
revoke execute on function extend_phase_deadline from public, anon, authenticated;
revoke execute on function extend_team from public, anon, authenticated;
revoke execute on function set_finalists from public, anon, authenticated;
revoke execute on function publish_finalists from public, anon, authenticated;
revoke execute on function submission_export from public, anon, authenticated;
grant execute on function extend_phase_deadline to service_role;
grant execute on function extend_team to service_role;
grant execute on function set_finalists to service_role;
grant execute on function publish_finalists to service_role;
grant execute on function submission_export to service_role;
