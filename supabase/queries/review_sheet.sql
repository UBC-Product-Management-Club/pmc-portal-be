-- Review sheet export ------------------------------------------------------------
--
-- One row per applicant for the events team's review sheet, oldest first. Times
-- are Pacific. Run in the Supabase SQL Editor with the event's id filled in.
--
-- resume_path is for tech only: the sync swaps it for a 7-day signed link before
-- the sheet is shared. The *_sent_pacific columns are read-only, from
-- Notification_Hook (blank = not sent yet).
-- -----------------------------------------------------------------------------

select
  a.attendee_id,
  a.status,
  a.created_at at time zone 'America/Vancouver' as submitted_pacific,
  a.event_form_answers->>'name' as name,
  a.event_form_answers->>'email' as email,
  a.event_form_answers->>'phone' as phone,
  u.is_payment_verified as is_member,
  a.event_form_answers->>'why_event' as why_event,
  a.event_form_answers->>'why_pm' as why_pm,
  a.event_form_answers->>'experience' as experience,
  a.event_form_answers->>'resume' as resume_path,
  a.payment_due_at at time zone 'America/Vancouver' as pay_by_pacific,
  (a.payment_due_at + interval '1 hour') at time zone 'America/Vancouver' as reopen_from_pacific,
  (a.status = 'ACCEPTED'
     and a.payment_due_at between now() and now() + interval '24 hours') as reminder_due,
  (select max(h.sent_at) from "Notification_Hook" h where h.attendee_id = a.attendee_id and h.type = 'accepted')
    at time zone 'America/Vancouver' as acceptance_sent_pacific,
  (select max(h.sent_at) from "Notification_Hook" h where h.attendee_id = a.attendee_id and h.type = 'rejected')
    at time zone 'America/Vancouver' as rejection_sent_pacific,
  (select max(h.sent_at) from "Notification_Hook" h where h.attendee_id = a.attendee_id and h.type = 'reminder')
    at time zone 'America/Vancouver' as reminder_sent_pacific
from "Attendee" a
join "User" u on u.user_id = a.user_id
join "Event" e on e.event_id = a.event_id
where a.event_id = '<event_id>'
order by a.created_at;
