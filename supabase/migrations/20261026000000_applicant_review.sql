-- Applicant review (PR 2) -----------------------------------------------------
--
-- Adds what reviewing applicants and holding their seat while they pay needs:
--
--   columns        reviewer and payment deadline on Attendee, the acceptance a
--                  checkout belongs to and how it was handled on
--                  Checkout_Session, the payment hold and schedule on Event, and
--                  a version on Drafts
--   Notification_Hook   one row per email the portal intends to send
--   seats_taken         now counts Accepted students only until their
--                       deadline plus a 1-hour grace
--   accept_applicants, reopen_payment_window, reject_applicants
--                       the only way decisions change; each locks the event row
--   fulfill_event_checkout
--                       decides, under the same lock, whether a Stripe checkout
--                       registers the student or has to be refunded
--
-- Hand-run in the Supabase SQL Editor (staging first), after
-- 20261025000000_register_checks.sql. Run the first statement (adding REJECTED)
-- on its own, then the rest: Postgres can't use a new enum value in the same
-- transaction that adds it.
-- -----------------------------------------------------------------------------

alter type "ATTENDEE_STATUS" add value if not exists 'REJECTED';

-- Columns ----------------------------------------------------------------------

alter table "Attendee"
  add column if not exists reviewed_by text,
  add column if not exists reviewed_at timestamptz,
  -- Set at acceptance as now() + payment_hold_hours and never recalculated
  add column if not exists payment_due_at timestamptz,
  -- Goes up by one on every acceptance or reopened window
  add column if not exists acceptance_version int not null default 0;

alter table "Checkout_Session"
  add column if not exists acceptance_version int,
  add column if not exists fulfilled_at timestamptz,
  -- The Stripe event that registered the student
  add column if not exists fulfilled_event_id text,
  add column if not exists refund_id text,
  add column if not exists attention_reason text,
  add column if not exists attention_resolved_at timestamptz;

alter table "Checkout_Session" drop constraint if exists checkout_session_attention_reason_check;
alter table "Checkout_Session" add constraint checkout_session_attention_reason_check
  check (attention_reason in ('LATE_PAYMENT', 'OLD_ACCEPTANCE', 'REJECTED', 'EVENT_FULL_LATE', 'NO_REVIEW_FULL'));

alter table "Event"
  -- How long an accepted student has to pay (Product Jackpot: 72)
  add column if not exists payment_hold_hours int not null default 72 check (payment_hold_hours > 0),
  add column if not exists timezone text not null default 'America/Vancouver',
  -- The public day-by-day schedule
  add column if not exists schedule jsonb;

alter table "Drafts"
  add column if not exists version int not null default 0;

-- Notification_Hook ------------------------------------------------------------

do $$ begin
  create type notification_type as enum ('application_received', 'accepted', 'rejected', 'reminder');
exception when duplicate_object then null;
end $$;

create table if not exists "Notification_Hook" (
  notification_id uuid primary key default gen_random_uuid(),
  event_id uuid not null references "Event" (event_id) on delete cascade,
  attendee_id uuid not null references "Attendee" (attendee_id) on delete cascade,
  type notification_type not null,
  acceptance_version int not null default 0,
  -- Now, or payment_due_at minus 24 hours for reminders
  eligible_at timestamptz not null,
  -- Snapshot when the row is made: recipient, event name and path, deadline, amount due
  payload jsonb not null,
  cancelled_at timestamptz,
  -- decided, registered, rejected or new_window
  cancel_reason text,
  sent_at timestamptz,
  sent_by text,
  provider text check (provider in ('manual', 'loops')),
  provider_message_id text,
  created_at timestamptz not null default now(),
  unique (event_id, attendee_id, type, acceptance_version)
);

-- Only the API reads and writes it
alter table "Notification_Hook" enable row level security;

create index if not exists notification_hook_due_idx
  on "Notification_Hook" (event_id, eligible_at) where sent_at is null and cancelled_at is null;

-- Indexes ----------------------------------------------------------------------

create index if not exists attendee_event_status_idx on "Attendee" (event_id, status);

-- submit_application already refuses a second application. This makes it a rule
-- of the table too. If it fails, find the duplicates first with:
--   select event_id, user_id, count(*) from "Attendee" group by 1, 2 having count(*) > 1;
do $$ begin
  if exists (select 1 from "Attendee" group by event_id, user_id having count(*) > 1) then
    raise exception 'Duplicate Attendee rows for the same event and user; remove them before running this migration';
  end if;
end $$;
create unique index if not exists attendee_event_user_key on "Attendee" (event_id, user_id);

-- Seats --------------------------------------------------------------------------

-- The one seat rule, used everywhere (accepting, reopening, the application cap
-- check, the webhook): Registered, or Accepted until 1 hour after their payment
-- deadline (grace for late Stripe confirmations)
create or replace function seats_taken(p_event_id uuid)
returns int language sql stable as $$
  select count(*)::int from "Attendee"
  where event_id = p_event_id
    and (status = 'REGISTERED'
         or (status = 'ACCEPTED' and payment_due_at + interval '1 hour' > now()));
$$;

-- Hooks --------------------------------------------------------------------------

-- Records one email intention with a snapshot of what it would say. Sending
-- happens elsewhere (the Loops sender or the Messages tab). event_path is
-- relative; the sender adds the portal's address. amount_due is the student's
-- price when the hook is made; the event page always shows the current price.
create or replace function record_hook(p_attendee_id uuid, p_type notification_type)
returns void language sql as $$
  insert into "Notification_Hook" (event_id, attendee_id, type, acceptance_version, eligible_at, payload)
  select a.event_id, a.attendee_id, p_type, a.acceptance_version,
         case when p_type = 'reminder' then a.payment_due_at - interval '24 hours' else now() end,
         jsonb_build_object(
           'recipient_name',  a.event_form_answers->>'name',
           'recipient_email', a.event_form_answers->>'email',
           'event_name',      e.name,
           'event_path',      '/events/' || e.event_id,
           'payment_due_at',  a.payment_due_at,
           'amount_due',      case when u.is_payment_verified then e.member_price else e.non_member_price end)
  from "Attendee" a
  join "Event" e on e.event_id = a.event_id
  left join "User" u on u.user_id = a.user_id
  where a.attendee_id = p_attendee_id
  on conflict (event_id, attendee_id, type, acceptance_version) do nothing;
$$;

-- Cancels unsent rows that no longer apply (decided, registered, rejected or
-- new_window): the receipt once a decision is made, and the accepted and
-- reminder rows. Sent rows stay as history.
create or replace function cancel_pending_hooks(p_attendee_id uuid, p_reason text)
returns void language sql as $$
  update "Notification_Hook" set cancelled_at = now(), cancel_reason = p_reason
  where attendee_id = p_attendee_id and type in ('application_received', 'accepted', 'reminder')
    and cancelled_at is null and sent_at is null;
$$;

-- Applications -------------------------------------------------------------------

-- Same checks as PR 1; a reviewed event also records the application_received hook
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

  if v_event.needs_review then
    perform record_hook(v_row.attendee_id, 'application_received');
  end if;

  return v_row;
end $$;

-- Same as PR 1, and registering cancels any unsent hooks
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
  perform cancel_pending_hooks(p_attendee_id, 'registered');

  return true;
end $$;

-- Decisions ----------------------------------------------------------------------
--
-- Tech changes decisions only through these functions, never by editing rows.
-- Accept and reopen are all-or-nothing: if the selection doesn't fit, nobody
-- changes and the error says how many seats are left. Running any of them twice
-- is harmless.

create or replace function accept_applicants(p_event_id uuid, p_attendee_ids uuid[], p_reviewer text)
returns integer language plpgsql as $$
declare v_cap int; v_hold int; v_new int; v_done int := 0; r record;
begin
  select max_attendees, payment_hold_hours into v_cap, v_hold
  from "Event" where event_id = p_event_id for update;

  select count(*) into v_new from "Attendee"
  where event_id = p_event_id and attendee_id = any(p_attendee_ids) and status = 'APPLIED';

  if v_cap is not null and seats_taken(p_event_id) + v_new > v_cap then
    raise exception 'EVENT_FULL: % seats left, % selected', v_cap - seats_taken(p_event_id), v_new;
  end if;

  for r in
    update "Attendee"
    set status = 'ACCEPTED', reviewed_by = p_reviewer, reviewed_at = now(),
        payment_due_at = now() + make_interval(hours => v_hold),
        acceptance_version = acceptance_version + 1
    where event_id = p_event_id and attendee_id = any(p_attendee_ids) and status = 'APPLIED'
    returning attendee_id
  loop
    perform cancel_pending_hooks(r.attendee_id, 'decided');   -- drops an unsent receipt
    perform record_hook(r.attendee_id, 'accepted');
    perform record_hook(r.attendee_id, 'reminder');
    v_done := v_done + 1;
  end loop;
  return v_done;
end $$;

create or replace function reopen_payment_window(p_event_id uuid, p_attendee_ids uuid[], p_reviewer text)
returns integer language plpgsql as $$
declare v_cap int; v_hold int; v_new int; v_done int := 0; r record;
begin
  select max_attendees, payment_hold_hours into v_cap, v_hold
  from "Event" where event_id = p_event_id for update;

  -- Only Accepted students whose deadline and grace have both passed
  select count(*) into v_new from "Attendee"
  where event_id = p_event_id and attendee_id = any(p_attendee_ids) and status = 'ACCEPTED'
    and payment_due_at + interval '1 hour' <= now();

  if v_cap is not null and seats_taken(p_event_id) + v_new > v_cap then
    raise exception 'EVENT_FULL: % seats left, % selected', v_cap - seats_taken(p_event_id), v_new;
  end if;

  for r in
    update "Attendee"
    set reviewed_by = p_reviewer, reviewed_at = now(),
        payment_due_at = now() + make_interval(hours => v_hold),
        acceptance_version = acceptance_version + 1
    where event_id = p_event_id and attendee_id = any(p_attendee_ids) and status = 'ACCEPTED'
      and payment_due_at + interval '1 hour' <= now()
    returning attendee_id
  loop
    perform cancel_pending_hooks(r.attendee_id, 'new_window');
    perform record_hook(r.attendee_id, 'accepted');
    perform record_hook(r.attendee_id, 'reminder');
    v_done := v_done + 1;
  end loop;
  return v_done;
end $$;

create or replace function reject_applicants(p_event_id uuid, p_attendee_ids uuid[], p_reviewer text)
returns integer language plpgsql as $$
declare v_done int := 0; r record;
begin
  perform 1 from "Event" where event_id = p_event_id for update;

  for r in
    update "Attendee"
    set status = 'REJECTED', reviewed_by = p_reviewer, reviewed_at = now()
    where event_id = p_event_id and attendee_id = any(p_attendee_ids)
      and status in ('APPLIED', 'ACCEPTED')
    returning attendee_id
  loop
    perform cancel_pending_hooks(r.attendee_id, 'rejected');
    perform record_hook(r.attendee_id, 'rejected');
    v_done := v_done + 1;
  end loop;
  return v_done;
end $$;

-- Checkout fulfillment -------------------------------------------------------------
--
-- Called by the webhook for every completed event checkout. Returns what
-- happened:
--   REGISTERED          the student now has their seat
--   ALREADY_FULFILLED   handled before (a repeated webhook); nothing changes
--   UNPAID              Stripe hasn't confirmed payment; nothing changes
--   NOT_FOUND           not a checkout this portal is tracking
--   or one of the attention reasons below, when the payment can't register the
--   student. The reason is recorded first, then the API refunds once with an
--   idempotency key and records refund_id. A repeated webhook returns the same
--   reason, so a refund that didn't finish is retried with the same key.
--
--   Reviewed events register only if the checkout's acceptance_version matches,
--   Stripe completed the payment before payment_due_at, the student is still
--   Accepted and, once the grace hour has passed, a seat is still free:
--     REJECTED         the student was rejected after starting checkout
--     OLD_ACCEPTANCE   the checkout belongs to an earlier acceptance
--     LATE_PAYMENT     Stripe completed it after payment_due_at
--     EVENT_FULL_LATE  confirmed after the grace hour and the event has filled
--   Events without review don't hold a seat while paying:
--     NO_REVIEW_FULL   the event filled first; the application is marked FAILED
create or replace function fulfill_event_checkout(
  p_checkout_id text,
  p_stripe_event_id text,
  p_paid boolean,
  p_completed_at timestamptz,
  p_payment_id text default null
)
returns text language plpgsql as $$
declare
  v_attendee_id uuid;
  v_event "Event";
  v_session "Checkout_Session";
  v_attendee "Attendee";
  v_reason text;
begin
  select attendee_id into v_attendee_id from "Checkout_Session" where checkout_id = p_checkout_id;
  if v_attendee_id is null then
    return 'NOT_FOUND';
  end if;

  select e.* into v_event from "Event" e
  join "Attendee" a on a.event_id = e.event_id
  where a.attendee_id = v_attendee_id
  for update of e;

  -- Re-read both under the lock
  select * into v_session from "Checkout_Session" where checkout_id = p_checkout_id;
  select * into v_attendee from "Attendee" where attendee_id = v_attendee_id;

  if v_session.fulfilled_at is not null then
    return coalesce(v_session.attention_reason, 'ALREADY_FULFILLED');
  end if;
  if not p_paid then
    return 'UNPAID';
  end if;

  if v_attendee.status = 'REGISTERED' then
    v_reason := null;   -- registered by an earlier checkout or a free RSVP
  elsif v_event.needs_review then
    if v_attendee.status = 'REJECTED' then
      v_reason := 'REJECTED';
    elsif v_attendee.status <> 'ACCEPTED'
          or v_session.acceptance_version is distinct from v_attendee.acceptance_version then
      v_reason := 'OLD_ACCEPTANCE';
    elsif p_completed_at >= v_attendee.payment_due_at then
      v_reason := 'LATE_PAYMENT';
    -- Inside the grace hour the student still counts in seats_taken; after it,
    -- they need a seat that's still free
    elsif now() >= v_attendee.payment_due_at + interval '1 hour'
          and v_event.max_attendees is not null
          and seats_taken(v_event.event_id) >= v_event.max_attendees then
      v_reason := 'EVENT_FULL_LATE';
    end if;
  elsif v_event.max_attendees is not null and seats_taken(v_event.event_id) >= v_event.max_attendees then
    v_reason := 'NO_REVIEW_FULL';
  end if;

  if v_reason is not null then
    update "Checkout_Session" set fulfilled_at = now(), attention_reason = v_reason
    where checkout_id = p_checkout_id;
    if v_reason = 'NO_REVIEW_FULL' then
      update "Attendee" set status = 'FAILED' where attendee_id = v_attendee_id;
    end if;
    return v_reason;
  end if;

  if v_attendee.status = 'REGISTERED' then
    update "Checkout_Session" set fulfilled_at = now() where checkout_id = p_checkout_id;
    return 'ALREADY_FULFILLED';
  end if;

  update "Attendee"
  set status = 'REGISTERED',
      is_payment_verified = p_payment_id is not null,
      payment_id = coalesce(p_payment_id, payment_id)
  where attendee_id = v_attendee_id;
  perform cancel_pending_hooks(v_attendee_id, 'registered');

  update "Checkout_Session" set fulfilled_at = now(), fulfilled_event_id = p_stripe_event_id
  where checkout_id = p_checkout_id;
  return 'REGISTERED';
end $$;

-- Access ---------------------------------------------------------------------------

-- Only the API (service role) may call these
revoke execute on function seats_taken from public, anon, authenticated;
revoke execute on function record_hook from public, anon, authenticated;
revoke execute on function cancel_pending_hooks from public, anon, authenticated;
revoke execute on function submit_application from public, anon, authenticated;
revoke execute on function register_if_seat_available from public, anon, authenticated;
revoke execute on function accept_applicants from public, anon, authenticated;
revoke execute on function reopen_payment_window from public, anon, authenticated;
revoke execute on function reject_applicants from public, anon, authenticated;
revoke execute on function fulfill_event_checkout from public, anon, authenticated;
grant execute on function seats_taken to service_role;
grant execute on function record_hook to service_role;
grant execute on function cancel_pending_hooks to service_role;
grant execute on function submit_application to service_role;
grant execute on function register_if_seat_available to service_role;
grant execute on function accept_applicants to service_role;
grant execute on function reopen_payment_window to service_role;
grant execute on function reject_applicants to service_role;
grant execute on function fulfill_event_checkout to service_role;
