-- Ops tooling (PR 5) -----------------------------------------------------------
--
-- The three read queries tech's scripts need, as functions so the scripts (which
-- go through the Supabase client, not raw SQL) and the SQL Editor run the same
-- thing:
--
--   review_sheet_rows   one row per applicant for the review sheet
--   messages_due        unsent hooks that still apply (the Messages tab)
--   payment_issues      checkouts with an unresolved attention_reason
--
-- Functions only, no table changes. Hand-run in the Supabase SQL Editor (staging
-- first), after 20261026000000_applicant_review.sql. Times come back as
-- timestamptz; the scripts show them in Pacific.
-- -----------------------------------------------------------------------------

-- resume_path is for tech only: the sync swaps it for a 7-day signed link
create or replace function review_sheet_rows(p_event_id uuid)
returns table (
  attendee_id uuid,
  status "ATTENDEE_STATUS",
  submitted_at timestamptz,
  name text,
  email text,
  phone text,
  is_member boolean,
  why_event text,
  why_pm text,
  experience text,
  resume_path text,
  payment_due_at timestamptz,
  reopen_from timestamptz,
  reminder_due boolean,
  acceptance_sent_at timestamptz,
  rejection_sent_at timestamptz,
  reminder_sent_at timestamptz
)
language sql stable as $$
  select
    a.attendee_id,
    a.status,
    a.created_at,
    a.event_form_answers->>'name',
    a.event_form_answers->>'email',
    a.event_form_answers->>'phone',
    coalesce(u.is_payment_verified, false),
    a.event_form_answers->>'why_event',
    a.event_form_answers->>'why_pm',
    a.event_form_answers->>'experience',
    a.event_form_answers->>'resume',
    a.payment_due_at,
    a.payment_due_at + interval '1 hour',
    coalesce(a.status = 'ACCEPTED' and a.payment_due_at between now() and now() + interval '24 hours', false),
    (select max(h.sent_at) from "Notification_Hook" h where h.attendee_id = a.attendee_id and h.type = 'accepted'),
    (select max(h.sent_at) from "Notification_Hook" h where h.attendee_id = a.attendee_id and h.type = 'rejected'),
    (select max(h.sent_at) from "Notification_Hook" h where h.attendee_id = a.attendee_id and h.type = 'reminder')
  from "Attendee" a
  left join "User" u on u.user_id = a.user_id
  where a.event_id = p_event_id
  order by a.created_at;
$$;

-- Everyone the portal would have emailed, by the same rules as the Loops sender:
-- a receipt only while still under review, a rejection only while still
-- rejected, accepted and reminder rows only for the current acceptance while its
-- window is open, and a reminder only if that acceptance went out before it
create or replace function messages_due(p_event_id uuid)
returns table (
  notification_id uuid,
  attendee_id uuid,
  type notification_type,
  acceptance_version int,
  name text,
  email text,
  payment_due_at timestamptz,
  amount_due text,
  eligible_at timestamptz
)
language sql stable as $$
  select h.notification_id, h.attendee_id, h.type, h.acceptance_version,
         h.payload->>'recipient_name', h.payload->>'recipient_email',
         (h.payload->>'payment_due_at')::timestamptz,
         h.payload->>'amount_due',
         h.eligible_at
  from "Notification_Hook" h
  join "Attendee" a on a.attendee_id = h.attendee_id
  where h.event_id = p_event_id and h.eligible_at <= now()
    and h.cancelled_at is null and h.sent_at is null
    and case h.type
          when 'application_received' then a.status = 'APPLIED'
          when 'rejected' then a.status = 'REJECTED'
          when 'accepted' then a.status = 'ACCEPTED'
               and h.acceptance_version = a.acceptance_version
               and now() < a.payment_due_at
          when 'reminder' then a.status = 'ACCEPTED'
               and h.acceptance_version = a.acceptance_version
               and now() < a.payment_due_at
               and exists (select 1 from "Notification_Hook" acc
                           where acc.attendee_id = h.attendee_id and acc.type = 'accepted'
                             and acc.acceptance_version = h.acceptance_version
                             and acc.sent_at is not null
                             and acc.sent_at <= h.eligible_at)
        end
  order by h.type, h.eligible_at;
$$;

-- Checkouts the webhook couldn't register and nobody has followed up yet. No
-- refund_id means the refund call didn't finish and needs a retry.
create or replace function payment_issues(p_event_id uuid)
returns table (
  checkout_id text,
  attendee_id uuid,
  name text,
  email text,
  amount_cents bigint,
  payment_id text,
  refund_id text,
  attention_reason text,
  handled_at timestamptz
)
language sql stable as $$
  select c.checkout_id, c.attendee_id,
         a.event_form_answers->>'name',
         coalesce(a.event_form_answers->>'email', u.email),
         p.amount::bigint,
         c.payment_id, c.refund_id, c.attention_reason, c.fulfilled_at
  from "Checkout_Session" c
  join "Attendee" a on a.attendee_id = c.attendee_id
  left join "User" u on u.user_id = a.user_id
  left join "Payment" p on p.payment_id = c.payment_id
  where a.event_id = p_event_id
    and c.attention_reason is not null and c.attention_resolved_at is null
  order by c.fulfilled_at;
$$;

-- Only the API and tech's scripts (service role) may call these
revoke execute on function review_sheet_rows from public, anon, authenticated;
revoke execute on function messages_due from public, anon, authenticated;
revoke execute on function payment_issues from public, anon, authenticated;
grant execute on function review_sheet_rows to service_role;
grant execute on function messages_due to service_role;
grant execute on function payment_issues to service_role;
