import { stripe } from "../config/stripe";
import { logEvent } from "../services/logEvent";
import { OpsRepository } from "../storage/OpsRepository";
import { Sheet } from "./sheet";
import { tickedMessages, TABS } from "./reviewSheet";

// Refunds the webhook recorded a reason for but didn't finish. The same
// idempotency key as the webhook (refund-<checkout_id>), so Stripe hands back the
// refund it already made instead of refunding twice.
export const retryRefunds = async (eventId: string) => {
  const { data, error } = await OpsRepository.paymentIssues(eventId);
  if (error) throw new Error(`Couldn't load payment issues: ${error.message}`);
  const missing = (data ?? []).filter((i) => !i.refund_id);
  const results: { checkoutId: string; refundId?: string; error?: string }[] = [];

  for (const issue of missing) {
    // Free checkouts and a payment that never reached the webhook have nothing to refund here
    if (!issue.payment_id?.startsWith("pi_") || !issue.amount_cents) {
      results.push({ checkoutId: issue.checkout_id, error: "No card payment to refund; check it in Stripe" });
      continue;
    }
    try {
      const refund = await stripe.refunds.create(
        { payment_intent: issue.payment_id },
        { idempotencyKey: `refund-${issue.checkout_id}` }
      );
      const saved = await OpsRepository.setRefund(issue.checkout_id, refund.id);
      if (saved.error) throw new Error(`refunded as ${refund.id} but couldn't record it: ${saved.error.message}`);
      results.push({ checkoutId: issue.checkout_id, refundId: refund.id });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      logEvent("PAYMENT_REFUND_REQUIRED", { reason: issue.attention_reason, checkoutId: issue.checkout_id, error: message });
      results.push({ checkoutId: issue.checkout_id, error: message });
    }
  }
  return results;
};

// After the events team has contacted the student
export const resolveIssue = async (checkoutId: string) => {
  const { data, error } = await OpsRepository.resolveIssue(checkoutId);
  if (error) throw new Error(`Couldn't resolve ${checkoutId}: ${error.message}`);
  if (!data?.length) throw new Error(`${checkoutId} isn't an open payment issue`);
};

// Marks exactly the messages that went out, by notification_id. Ids already
// marked are left alone and reported.
export const markSent = async (notificationIds: string[], sentBy: string) => {
  const ids = [...new Set(notificationIds.map((id) => id.trim()).filter(Boolean))];
  if (!ids.length) throw new Error("No notification ids given");
  if (!sentBy.trim()) throw new Error("Say who sent them (--by)");
  const { data, error } = await OpsRepository.markSent(ids, sentBy.trim());
  if (error) throw new Error(`Couldn't mark messages sent: ${error.message}`);
  const marked = new Set((data ?? []).map((r) => r.notification_id));
  return { marked: [...marked], alreadyMarkedOrUnknown: ids.filter((id) => !marked.has(id)) };
};

export const markSentFromSheet = async (sheet: Sheet, sentBy: string) =>
  markSent(tickedMessages(await sheet.read(TABS.messages)), sentBy);
