-- Submissions (PR 8) -------------------------------------------------------------
--
-- The submission window and the stale-save check, decided by the database:
--
--   submission_phases    the event's phases for the form: fields, the caller's
--                        team extension and the database's time for the countdown
--   submission_context   what the API needs before uploading: the team, the
--                        phase's fields and the current answers; it also fails
--                        early when the window is shut, so nobody uploads a
--                        25 MB deck for nothing
--   save_submission      the write. It runs after the upload, locks the team row
--                        (the same lock joining and leaving take) and checks the
--                        window again with clock_timestamp(), so a save counts
--                        only if starttime <= its finish < the team's deadline
--   team_submission      the saved answers as the form shows them
--
-- Errors are raised by name: NOT_REGISTERED, NOT_ON_TEAM, NOT_FOUND, DISABLED,
-- NOT_OPEN, CLOSED, TEAM_TOO_SMALL, STALE.
--
-- Hand-run in the Supabase SQL Editor (staging first), after
-- 20261029000000_team_rules.sql. Safe to re-run.
-- -----------------------------------------------------------------------------

-- One of the event's phases, or NOT_FOUND
create or replace function event_phase(p_event_id uuid, p_phase_id uuid)
returns "Deliverable_Flags" language plpgsql stable as $$
declare v_phase "Deliverable_Flags";
begin
  select * into v_phase from "Deliverable_Flags" where id = p_phase_id and event_id = p_event_id;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  return v_phase;
end $$;

-- Raises unless the window is open at p_at for this team. Half-open: open from
-- starttime (none means open), closed from the later of the deadline and the
-- team's extension.
create or replace function check_submission_window(p_phase "Deliverable_Flags", p_team_id uuid, p_at timestamptz)
returns void language plpgsql stable as $$
begin
  if not p_phase.is_enabled then
    raise exception 'DISABLED';
  end if;
  if p_phase.starttime is not null and p_at < p_phase.starttime then
    raise exception 'NOT_OPEN';
  end if;
  if p_at >= (select greatest(p_phase.deadline, t.extended_until) from "Team" t where t.team_id = p_team_id) then
    raise exception 'CLOSED';
  end if;
end $$;

-- File answers are stored as private paths; the form only shows the file name
create or replace function submission_view(p_deliverable "Deliverable", p_fields jsonb)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'submission', coalesce((
      select jsonb_object_agg(a.key,
        case when exists (select 1 from jsonb_array_elements(p_fields) f where f->>'id' = a.key and f->>'type' = 'file')
             then to_jsonb(regexp_replace(a.value #>> '{}', '^.*/', ''))
             else a.value end)
      from jsonb_each(p_deliverable.submission) a), '{}'::jsonb),
    'version', p_deliverable.version,
    'submitted_at', p_deliverable.submitted_at,
    'submitted_by', (
      select applicant_name(a, u)
      from "User" u
      left join "Attendee" a on a.user_id = u.user_id and a.event_id = p_deliverable.event_id
      where u.user_id = p_deliverable.submitted_by));
$$;

create or replace function submission_phases(p_event_id uuid, p_user_id "Attendee".user_id%type)
returns jsonb language plpgsql stable as $$
declare
  v_attendee "Attendee" := registered_attendee(p_event_id, p_user_id);
  v_extended timestamptz;
begin
  select t.extended_until into v_extended
  from "Team_Member" m join "Team" t on t.team_id = m.team_id
  where m.attendee_id = v_attendee.attendee_id;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', f.id, 'event_id', f.event_id, 'starttime', f.starttime, 'deadline', f.deadline,
      'is_enabled', f.is_enabled, 'fields', f.fields,
      'extended_until', v_extended, 'server_time', now()
    ) order by f.deadline)
    from "Deliverable_Flags" f where f.event_id = p_event_id), '[]'::jsonb);
end $$;

create or replace function team_submission(p_event_id uuid, p_user_id "Attendee".user_id%type, p_phase_id uuid)
returns jsonb language plpgsql stable as $$
declare
  v_team_id uuid := member_team_id(p_event_id, p_user_id);
  v_phase "Deliverable_Flags" := event_phase(p_event_id, p_phase_id);
  v_row "Deliverable";
begin
  select * into v_row from "Deliverable" where team_id = v_team_id and phase_id = p_phase_id::text;
  if not found then
    return null;
  end if;
  return submission_view(v_row, v_phase.fields);
end $$;

create or replace function submission_context(p_event_id uuid, p_user_id "Attendee".user_id%type, p_phase_id uuid)
returns jsonb language plpgsql stable as $$
declare
  v_team_id uuid := member_team_id(p_event_id, p_user_id);
  v_phase "Deliverable_Flags" := event_phase(p_event_id, p_phase_id);
begin
  perform check_submission_window(v_phase, v_team_id, now());
  return jsonb_build_object(
    'team_id', v_team_id,
    'fields', v_phase.fields,
    'submission', (select submission from "Deliverable" where team_id = v_team_id and phase_id = p_phase_id::text));
end $$;

-- p_submission is the team's complete entry, already checked by the API; it
-- replaces the saved one only if nobody has saved since p_expected_version
create or replace function save_submission(
  p_event_id uuid,
  p_user_id "Attendee".user_id%type,
  p_phase_id uuid,
  p_submission jsonb,
  p_expected_version int
)
returns jsonb language plpgsql as $$
declare
  v_team_id uuid := member_team_id(p_event_id, p_user_id);
  v_phase "Deliverable_Flags" := event_phase(p_event_id, p_phase_id);
  v_min int;
  v_row "Deliverable";
begin
  perform 1 from "Team" where team_id = v_team_id for update;
  -- clock_timestamp, not now(): now() is when the transaction began, and this
  -- may have waited on the lock
  perform check_submission_window(v_phase, v_team_id, clock_timestamp());

  select min_team_size into v_min from "Event" where event_id = p_event_id;
  if (select count(*) from "Team_Member" where team_id = v_team_id) < v_min then
    raise exception 'TEAM_TOO_SMALL';
  end if;

  select * into v_row from "Deliverable" where team_id = v_team_id and phase_id = p_phase_id::text;
  if coalesce(v_row.version, 0) <> p_expected_version then
    raise exception 'STALE';
  end if;

  insert into "Deliverable" (event_id, team_id, phase_id, submission, submitted_at, submitted_by, version)
  values (p_event_id, v_team_id, p_phase_id::text, p_submission, clock_timestamp(), p_user_id, 1)
  on conflict (event_id, team_id, phase_id) do update
    set submission = excluded.submission, submitted_at = excluded.submitted_at,
        submitted_by = excluded.submitted_by, version = "Deliverable".version + 1
  returning * into v_row;

  return submission_view(v_row, v_phase.fields);
end $$;

-- Only the API (service role) may call these
revoke execute on function event_phase from public, anon, authenticated;
revoke execute on function check_submission_window from public, anon, authenticated;
revoke execute on function submission_view from public, anon, authenticated;
revoke execute on function submission_phases from public, anon, authenticated;
revoke execute on function team_submission from public, anon, authenticated;
revoke execute on function submission_context from public, anon, authenticated;
revoke execute on function save_submission from public, anon, authenticated;
grant execute on function event_phase to service_role;
grant execute on function check_submission_window to service_role;
grant execute on function submission_view to service_role;
grant execute on function submission_phases to service_role;
grant execute on function team_submission to service_role;
grant execute on function submission_context to service_role;
grant execute on function save_submission to service_role;
