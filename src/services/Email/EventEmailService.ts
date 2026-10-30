import { APIError, RateLimitExceededError } from "loops";
import { loops } from "../../config/loops";
import { Enums, Json, Tables } from "../../schema/v2/database.types";
import { NotificationRepository } from "../../storage/NotificationRepository";

// Event emails (Product Jackpot): Notification_Hook → re-check now → Loops → sent_at.
// Everything here sits behind EMAIL_DELIVERY_ENABLED, which stays false until the
// four Loops templates have real copy; until then the events team sends from the
// Messages tab. The Loops calls that already run (signup contact, membership
// payment, mailing list) don't go through this file.

type NotificationType = Enums<"notification_type">;

const TEMPLATE_ENV: Record<NotificationType, string> = {
  application_received: "LOOPS_APPLICATION_RECEIVED_ID",
  accepted: "LOOPS_ACCEPTED_ID",
  rejected: "LOOPS_REJECTED_ID",
  reminder: "LOOPS_REMINDER_ID",
};

const MAX_ATTEMPTS = 3;

export const isEmailDeliveryEnabled = () => process.env.EMAIL_DELIVERY_ENABLED === "true";

// Only rate limits, server errors and network failures are retried, always with
// the same key. Anything else (a 409 included) is for a person to look at.
const isRetryable = (error: unknown) =>
  error instanceof RateLimitExceededError ||
  (error instanceof APIError ? error.statusCode >= 500 : !(error instanceof Error && error.name === "ValidationError"));

// Only talks to Loops. Fails closed: with delivery off, or a key or template
// missing, it throws instead of pretending to send.
export const sendEventEmail = async (
  type: NotificationType,
  email: string,
  vars: Record<string, string>,
  notificationId: string
) => {
  if (!isEmailDeliveryEnabled()) throw new Error("Event email delivery is off");
  const transactionalId = process.env[TEMPLATE_ENV[type]];
  if (!process.env.LOOPS_API_KEY) throw new Error("LOOPS_API_KEY is not set");
  if (!transactionalId) throw new Error(`${TEMPLATE_ENV[type]} is not set`);

  // The same key on every attempt, so Loops sends one email per notification
  const headers = { "Idempotency-Key": `product-jackpot:${notificationId}` };
  for (let attempt = 1; ; attempt++) {
    try {
      return await loops.sendTransactionalEmail({ transactionalId, email, dataVariables: vars, headers });
    } catch (error) {
      if (attempt >= MAX_ATTEMPTS || !isRetryable(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
    }
  }
};

type Hook = Tables<"Notification_Hook">;
type AttendeeNow = Pick<Tables<"Attendee">, "status" | "acceptance_version" | "payment_due_at">;

// The who-to-message rules: a receipt only while still under review, a rejection
// only while still rejected, and accepted and reminder rows only for the current
// acceptance while its window is open. A reminder also needs that acceptance's
// email to have gone out before the reminder's time; otherwise it's skipped.
export const isDue = (hook: Hook, attendee: AttendeeNow, acceptedSentAt: string | null, now = new Date()) => {
  if (hook.sent_at || hook.cancelled_at || new Date(hook.eligible_at) > now) return false;
  const windowOpen =
    attendee.status === "ACCEPTED" &&
    hook.acceptance_version === attendee.acceptance_version &&
    !!attendee.payment_due_at &&
    now < new Date(attendee.payment_due_at);
  switch (hook.type) {
    case "application_received":
      return attendee.status === "APPLIED";
    case "rejected":
      return attendee.status === "REJECTED";
    case "accepted":
      return windowOpen;
    case "reminder":
      return windowOpen && !!acceptedSentAt && new Date(acceptedSentAt) <= new Date(hook.eligible_at);
  }
};

const formatAmount = (amount: Json | undefined) =>
  typeof amount === "number" || typeof amount === "string" ? `$${Number(amount).toFixed(2)}` : "";

// e.g. "Wednesday, November 4 at 12:00 PM PT"
const formatPacific = (iso: Json | undefined) =>
  typeof iso === "string"
    ? new Date(iso).toLocaleString("en-US", {
        timeZone: "America/Vancouver",
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).replace(/, (\d)/, " at $1") + " PT"
    : "";

// The template variables, from the snapshot taken when the hook was made. The
// email links to the event page, never to Stripe.
export const templateVars = (hook: Hook) => {
  const payload = (hook.payload ?? {}) as Record<string, Json | undefined>;
  const vars: Record<string, string> = {
    recipientName: String(payload.recipient_name ?? ""),
    eventName: String(payload.event_name ?? ""),
    eventUrl: `${process.env.ORIGIN}${payload.event_path ?? ""}`,
  };
  if (hook.type === "accepted" || hook.type === "reminder") {
    vars.amountDue = formatAmount(payload.amount_due);
    vars.paymentDue = formatPacific(payload.payment_due_at);
  }
  return vars;
};

export type DeliveryResult = "sent" | "skipped" | "disabled";

// Reads the hook and the attendee, re-checks, skips a stale row, sends, then
// marks it sent. sent_at is only set after Loops accepts, so a failed or
// disabled attempt leaves the row for the next run or the Messages tab.
export const deliverNotification = async (notificationId: string): Promise<DeliveryResult> => {
  if (!isEmailDeliveryEnabled()) return "disabled";

  const { data, error } = await NotificationRepository.getHook(notificationId);
  if (error) throw new Error(`Failed to load notification ${notificationId}: ${error.message}`);
  if (!data) return "skipped";
  const { Attendee: attendee, ...hook } = data;

  let acceptedSentAt: string | null = null;
  if (hook.type === "reminder") {
    const accepted = await NotificationRepository.findHook(hook.attendee_id, "accepted", hook.acceptance_version);
    if (accepted.error) throw new Error(`Failed to load acceptance for ${notificationId}: ${accepted.error.message}`);
    acceptedSentAt = accepted.data?.sent_at ?? null;
  }
  if (!isDue(hook, attendee, acceptedSentAt)) return "skipped";

  const email = (hook.payload as Record<string, Json | undefined>)?.recipient_email;
  if (typeof email !== "string" || !email) throw new Error(`Notification ${notificationId} has no recipient email`);

  await sendEventEmail(hook.type, email, templateVars(hook), notificationId);
  const marked = await NotificationRepository.markSent(notificationId, "loops");
  if (marked.error) throw new Error(`Sent ${notificationId} but couldn't mark it sent: ${marked.error.message}`);
  return "sent";
};

// After an application is saved: send its receipt if delivery is on. Never
// throws, so a Loops problem can't fail the application.
export const deliverApplicationReceipt = async (attendeeId: string) => {
  if (!isEmailDeliveryEnabled()) return;
  try {
    const { data, error } = await NotificationRepository.findHook(attendeeId, "application_received", 0);
    if (error) throw error;
    if (data) await deliverNotification(data.notification_id);
  } catch (error) {
    console.error(JSON.stringify({ event: "EMAIL_FAILED", attendeeId, type: "application_received", error: String(error) }));
  }
};
