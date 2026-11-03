-- Registration checks (PR 1) ---------------------------------------------------
--
-- Moves the parts of registering that have to be decided by the database into
-- functions, so two requests at once can't both get the last seat:
--
--   seats_taken                  how many seats an event has given out
--   submit_application           window, duplicate and cap checks, then the insert
--   register_if_seat_available   the atomic cap check for free and no-review events
--
-- Each function that can change seats locks the event's row first, so requests
-- for the same event run one at a time. Times are the database's, never the
-- server's or the browser's.
--
-- Like the recruiting migration, this file is hand-run in the Supabase SQL Editor
-- (staging first). No table changes, so the generated types only gain the three
-- functions.
-- -----------------------------------------------------------------------------

-- Registered students plus accepted students. The applicant review PR narrows
-- "accepted" to students still inside their payment window (plus a 1-hour grace).
create or replace function seats_taken(p_event_id uuid)
returns int language sql stable as $$
  select count(*)::int from "Attendee"
  where event_id = p_event_id
    and status in ('REGISTERED', 'ACCEPTED');
$$;

-- Saves an application. Errors are raised with the code the API sends back:
-- NOT_FOUND, CLOSED (disabled or past registration_closes), NOT_OPEN,
-- ALREADY_APPLIED or EVENT_FULL. Answers are already checked by the API.
create or replace function submit_application(
  p_event_id uuid,
  p_user_id "Attendee".user_id%type,
  p_answers jsonb
)
returns "Attendee" language plpgsql as $$
declare
  v_event "Event";
  v_row "Attendee";
begin
  select * into v_event from "Event" where event_id = p_event_id for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;

  -- Open from registration_opens, closed from registration_closes onward
  if coalesce(v_event.is_disabled, false)
     or (v_event.registration_closes is not null and now() >= v_event.registration_closes) then
    raise exception 'CLOSED';
  end if;
  if v_event.registration_opens is not null and now() < v_event.registration_opens then
    raise exception 'NOT_OPEN';
  end if;

  if exists (select 1 from "Attendee" where event_id = p_event_id and user_id = p_user_id) then
    raise exception 'ALREADY_APPLIED';
  end if;

  if v_event.max_attendees is not null and seats_taken(p_event_id) >= v_event.max_attendees then
    raise exception 'EVENT_FULL';
  end if;

  insert into "Attendee" (user_id, event_id, event_form_answers, is_payment_verified, payment_id, status)
  values (
    p_user_id,
    p_event_id,
    p_answers,
    false,
    null,
    (case when v_event.needs_review then 'APPLIED' else 'PROCESSING' end)::"ATTENDEE_STATUS"
  )
  returning * into v_row;

  return v_row;
end $$;

-- Registers one attendee if a seat is free; returns false when the event is full.
-- Used for free events and events without review, where a pending payment doesn't
-- hold a seat. Calling it again for someone already registered returns true and
-- changes nothing, so a repeated webhook is harmless.
create or replace function register_if_seat_available(
  p_attendee_id uuid,
  p_payment_id text default null
)
returns boolean language plpgsql as $$
declare
  v_event_id uuid;
  v_status "Attendee".status%type;
  v_cap int;
begin
  select event_id, status into v_event_id, v_status from "Attendee" where attendee_id = p_attendee_id;
  if v_event_id is null then
    raise exception 'NOT_FOUND';
  end if;

  select max_attendees into v_cap from "Event" where event_id = v_event_id for update;

  -- Re-read under the lock: another request may have registered this attendee meanwhile
  select status into v_status from "Attendee" where attendee_id = p_attendee_id;
  if v_status = 'REGISTERED' then
    return true;
  end if;

  if v_cap is not null and seats_taken(v_event_id) >= v_cap then
    return false;
  end if;

  update "Attendee"
  set status = 'REGISTERED',
      is_payment_verified = case when p_payment_id is not null then true else is_payment_verified end,
      payment_id = coalesce(p_payment_id, payment_id)
  where attendee_id = p_attendee_id;

  return true;
end $$;

-- Only the API (service role) may call these
revoke execute on function seats_taken from public, anon, authenticated;
revoke execute on function submit_application from public, anon, authenticated;
revoke execute on function register_if_seat_available from public, anon, authenticated;
grant execute on function seats_taken to service_role;
grant execute on function submit_application to service_role;
grant execute on function register_if_seat_available to service_role;
