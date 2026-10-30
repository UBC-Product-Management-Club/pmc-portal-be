-- Payment issues ------------------------------------------------------------------
--
-- Checkouts the webhook couldn't register, for the Payment issues tab: the
-- student, what they paid, the refund and why. The events team contacts the
-- student; tech then marks the row resolved (below). A row with no refund_id
-- means the refund call didn't finish: retry it with the same idempotency key
-- (refund-<checkout_id>) on payment_id until a refund_id is recorded.
--
--   LATE_PAYMENT     Stripe completed it after the payment deadline
--   OLD_ACCEPTANCE   the checkout was from an earlier acceptance
--   REJECTED         the student was rejected after starting checkout
--   EVENT_FULL_LATE  confirmed after the grace hour and the event had filled
--   NO_REVIEW_FULL   an event without review filled before the payment landed
-- -----------------------------------------------------------------------------

select
  c.checkout_id,
  c.attendee_id,
  a.event_form_answers->>'name' as name,
  coalesce(a.event_form_answers->>'email', u.email) as email,
  p.amount as amount_cents,
  c.payment_id,
  c.refund_id,
  c.attention_reason,
  c.fulfilled_at at time zone 'America/Vancouver' as handled_pacific
from "Checkout_Session" c
join "Attendee" a on a.attendee_id = c.attendee_id
join "User" u on u.user_id = a.user_id
left join "Payment" p on p.payment_id = c.payment_id
where a.event_id = '<event_id>'
  and c.attention_reason is not null and c.attention_resolved_at is null
order by c.fulfilled_at;

-- Once the student has been contacted
-- update "Checkout_Session" set attention_resolved_at = now() where checkout_id = '<checkout_id>';
