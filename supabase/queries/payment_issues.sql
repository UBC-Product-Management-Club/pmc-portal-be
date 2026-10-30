-- Payment issues ------------------------------------------------------------------
--
-- Checkouts the webhook couldn't register, for the Payment issues tab: the
-- student, what they paid, the refund and why. The events team contacts the
-- student; tech then runs `npm run ops -- resolve`. A row with no refund_id
-- means the refund call didn't finish: `npm run ops -- retry-refunds` retries it
-- on payment_id with the same idempotency key (refund-<checkout_id>).
--
--   LATE_PAYMENT     Stripe completed it after the payment deadline
--   OLD_ACCEPTANCE   the checkout was from an earlier acceptance
--   REJECTED         the student was rejected after starting checkout
--   EVENT_FULL_LATE  confirmed after the grace hour and the event had filled
--   NO_REVIEW_FULL   an event without review filled before the payment landed
-- -----------------------------------------------------------------------------

select * from payment_issues('<event_id>');

-- The same as resolve, by hand:
-- update "Checkout_Session" set attention_resolved_at = now() where checkout_id = '<checkout_id>';
