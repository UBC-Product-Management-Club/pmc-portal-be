-- Who is due a message now ----------------------------------------------------------
--
-- For the Messages tab while event-email delivery is off: every unsent hook that
-- still applies. The same rules as deliverNotification in EventEmailService.ts:
-- a receipt only while still under review, a rejection only while still
-- rejected, accepted and reminder rows only for the current acceptance while its
-- window is open, and a reminder only if that acceptance went out before it.
-- -----------------------------------------------------------------------------

select h.notification_id, h.attendee_id, h.type, h.acceptance_version,
       h.payload->>'recipient_name' as name, h.payload->>'recipient_email' as email,
       (h.payload->>'payment_due_at')::timestamptz at time zone 'America/Vancouver' as pay_by_pacific,
       h.payload->>'amount_due' as amount_due,
       h.eligible_at at time zone 'America/Vancouver' as due_pacific
from "Notification_Hook" h
join "Attendee" a on a.attendee_id = h.attendee_id
where h.event_id = '<event_id>' and h.eligible_at <= now()
  and h.cancelled_at is null and h.sent_at is null
  and case h.type
        when 'application_received' then a.status = 'APPLIED'   -- skip the receipt once a decision is made
        when 'rejected' then a.status = 'REJECTED'
        when 'accepted' then a.status = 'ACCEPTED'
             and h.acceptance_version = a.acceptance_version    -- current acceptance only
             and now() < a.payment_due_at                       -- while its window is open
        when 'reminder' then a.status = 'ACCEPTED'
             and h.acceptance_version = a.acceptance_version
             and now() < a.payment_due_at
             and exists (select 1 from "Notification_Hook" acc   -- only after the acceptance was sent
                         where acc.attendee_id = h.attendee_id and acc.type = 'accepted'
                           and acc.acceptance_version = h.acceptance_version
                           and acc.sent_at is not null
                           and acc.sent_at <= h.eligible_at)  -- a late acceptance skips the reminder
      end
order by h.type, h.eligible_at;

-- After the events team confirms, mark only the ids that actually went out
-- update "Notification_Hook" set sent_at = now(), sent_by = '<who sent them>', provider = 'manual'
-- where notification_id = any(array['<id_1>', '<id_2>']::uuid[]) and sent_at is null;
