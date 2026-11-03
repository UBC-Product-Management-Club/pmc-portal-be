import { stripe } from "../../config/stripe";
import { fetchMembershipPriceId } from "../Product/ProductService";
import Stripe from "stripe";
import { PaymentRepository } from "../../storage/PaymentRepository";
import { UserRepository } from "../../storage/UserRepository";
import { CheckoutSessionRepository } from "../../storage/CheckoutSessionRepository";
import { addToMailingList, LoopsEvent, sendEmail } from "../Email/EmailService";
import { Tables } from "../../schema/v2/database.types";
import {
  deleteAttendee,
  getAttendeeWithEvent,
  updateAttendee,
} from "../Attendee/AttendeeService";
import { ApiError } from "../ApiError";
import { logEvent } from "../logEvent";

export enum Status {
  PAYMENT_SUCCESS = "PAYMENT_SUCCESS",
  PAYMENT_FAILED = "PAYMENT_FAILED",
  PAYMENT_PENDING = "PAYMENT_PENDING",
  PAYMENT_CANCELED = "PAYMENT_CANCELED",
}

// in cents
export const MEMBERSHIP_FEE_UBC = 1067;
export const MEMBERSHIP_FEE_NONUBC = 2067;

export const createMembershipPaymentIntent = async (userId: string) => {
  const { data, error } = await UserRepository.getUser(userId);

  if (error) {
    throw new Error(error.message);
  }

  const isUBC = data?.university === "University of British Columbia";
  const amount = isUBC ? MEMBERSHIP_FEE_UBC : MEMBERSHIP_FEE_NONUBC;

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amount,
    currency: "cad",
    metadata: {
      user_id: userId,
      payment_type: "membership",
    },
  } as Stripe.PaymentIntentCreateParams);

  return paymentIntent;
};

export const createCheckoutSession = async (userId: string) => {
  const { data, error } = await UserRepository.getUser(userId);

  if (error) {
    throw new Error(error.message);
  }

  const isUBC = data?.university === "University of British Columbia";

  const priceId = await fetchMembershipPriceId(isUBC);
  const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    mode: "payment",
    payment_method_configuration: process.env.CARD_PAYMENT_METHOD_ID,
    success_url: `${process.env.ORIGIN}/dashboard/success`,
    cancel_url: `${process.env.ORIGIN}/dashboard/canceled`,
    metadata: {
      user_id: userId,
      payment_type: "membership",
    },
    payment_intent_data: {
      metadata: {
        user_id: userId,
        payment_type: "membership",
      },
    },
  });
  return session;
};

export const saveCheckoutSession = async (row: {
  attendee_id: string;
  checkout_id: string;
  acceptance_version: number | null;
  expires_at: string;
}) => {
  const { error } = await CheckoutSessionRepository.saveCheckoutSession(row);
  if (error) {
    throw error;
  }
};

export const getCheckoutSession = async (attendeeId: string) => {
  const { data, error } = await CheckoutSessionRepository.getCheckoutSession(
    attendeeId
  );
  if (error) {
    throw error;
  }
  return data ? stripe.checkout.sessions.retrieve(data.checkout_id) : null;
};

// True when this is the attendee's current checkout, Stripe has taken the
// payment, and the webhook hasn't handled it yet
export const isCheckoutAwaitingFulfillment = async (attendeeId: string, sessionId: string) => {
  const { data, error } = await CheckoutSessionRepository.getCheckoutSession(attendeeId);
  if (error) throw error;
  if (!data || data.checkout_id !== sessionId || data.fulfilled_at) return false;
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  return session.status === "complete" && session.payment_status === "paid";
};

export const deleteCheckoutSession = async (attendeeId: string) => {
  const { error } = await CheckoutSessionRepository.deleteCheckoutSession(
    attendeeId
  );
  if (error) {
    throw new Error(error.message);
  }
};

type CheckoutAttendee = Pick<Tables<"Attendee">, "attendee_id" | "status" | "payment_due_at" | "acceptance_version">;

// When a checkout expires, in Unix seconds: the end of the payment hold, but at
// most 24 hours away and never under Stripe's 30 minutes. Events without review
// have no hold and get the minimum. Rounded to the minute so repeated clicks
// within a minute send Stripe the same request and get the same session back.
export const checkoutExpiry = (paymentDueAt: string | null, now = Date.now()) => {
  const nowS = Math.floor(now / 1000);
  const earliest = Math.ceil((nowS + 31 * 60) / 60) * 60;
  const latest = Math.floor((nowS + 24 * 60 * 60) / 60) * 60;
  if (!paymentDueAt) return earliest;
  const due = Math.floor(new Date(paymentDueAt).getTime() / 1000);
  return Math.max(earliest, Math.min(due, latest));
};

// Reviewed events: only Accepted students inside their payment window can pay.
// An open checkout is reused only if it's for the same acceptance and price
// (membership can change the price); otherwise it's expired and replaced.
export const getOrCreateEventCheckoutSession = async (
  attendee: CheckoutAttendee,
  event: { event_id: string; needs_review: boolean },
  userId: string,
  priceId: string
) => {
  const attendeeId = attendee.attendee_id;
  if (attendee.status === "REGISTERED") {
    throw new ApiError(409, "ALREADY_REGISTERED", "You're already registered.");
  }
  if (event.needs_review) {
    if (attendee.status !== "ACCEPTED") {
      throw new ApiError(409, "NOT_ACCEPTED", "There's nothing to pay for yet.");
    }
    if (!attendee.payment_due_at || new Date() >= new Date(attendee.payment_due_at)) {
      throw new ApiError(409, "HOLD_EXPIRED", "Your payment window has closed.");
    }
  }
  const version = event.needs_review ? String(attendee.acceptance_version) : "none";

  const { data: existing, error } = await CheckoutSessionRepository.getCheckoutSession(attendeeId);
  if (error) throw error;
  if (existing && !existing.fulfilled_at) {
    const current = await stripe.checkout.sessions.retrieve(existing.checkout_id);
    if (current.status === "complete") {
      throw new ApiError(409, "PAYMENT_PROCESSING", "Your payment is still processing.");
    }
    const sameTerms = current.metadata?.acceptance_version === version && current.metadata?.price_id === priceId;
    if (current.status === "open" && sameTerms) return current;
    if (current.status === "open") await stripe.checkout.sessions.expire(current.id);
  }
  if (existing?.attention_reason && !existing.attention_resolved_at) {
    // The row is replaced below, so the unresolved payment issue goes to the logs too
    logEvent("ATTENTION_REPLACED", {
      attendeeId,
      checkoutId: existing.checkout_id,
      reason: existing.attention_reason,
      refundId: existing.refund_id ?? "",
    });
  }

  const expiresAt = checkoutExpiry(event.needs_review ? attendee.payment_due_at : null);
  const metadata = {
    user_id: userId,
    payment_type: "event",
    attendee_id: attendeeId,
    event_id: event.event_id,
    acceptance_version: version,
  };
  const session = await stripe.checkout.sessions.create(
    {
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "payment",
      payment_method_configuration: process.env.CARD_PAYMENT_METHOD_ID,
      success_url: `${process.env.ORIGIN}/events/${event.event_id}?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.ORIGIN}/events/${event.event_id}`, // you cant actually cancel a checkout session.
      expires_at: expiresAt,
      metadata: { ...metadata, price_id: priceId },
      payment_intent_data: { metadata },
    },
    { idempotencyKey: `event-checkout-${attendeeId}-v${version}-${priceId}-${expiresAt}` }
  );
  await saveCheckoutSession({
    attendee_id: attendeeId,
    checkout_id: session.id,
    acceptance_version: event.needs_review ? attendee.acceptance_version : null,
    expires_at: new Date(expiresAt * 1000).toISOString(),
  });
  return session;
};

export const getOrCreateRSVPCheckoutSession = async (
  attendeeId: string,
  eventId: string,
  userId: string,
  priceId: string
) => {
  try {
    const existing = await getCheckoutSession(attendeeId);
    if (existing) {
      return existing;
    }
    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "payment",
      payment_method_configuration: process.env.CARD_PAYMENT_METHOD_ID,
      success_url: `${process.env.ORIGIN}/events/${eventId}`,
      cancel_url: `${process.env.ORIGIN}/events/${eventId}`, // you cant actually cancel a checkout session.
      metadata: {
        user_id: userId,
        payment_type: "event",
        attendee_id: attendeeId,
      },
      payment_intent_data: {
        metadata: {
          user_id: userId,
          payment_type: "event",
          attendee_id: attendeeId,
        },
      },
    });
    await saveCheckoutSession({
      attendee_id: attendeeId,
      checkout_id: session.id,
      acceptance_version: null,
      expires_at: new Date(session.expires_at * 1000).toISOString(),
    });
    return session;
  } catch (error: any) {
    console.error(error);
    throw error;
  }
};

export const handleStripeEvent = async (event: Stripe.Event) => {
  const stripeEventType = event.type;

  switch (stripeEventType) {
    case "checkout.session.completed":
    case "checkout.session.expired":
      await handleCheckoutSession(event);
      break;
    case "payment_intent.succeeded":
    case "payment_intent.payment_failed":
    case "payment_intent.processing":
    case "payment_intent.canceled":
      await handlePaymentIntent(event);
      break;
    default:
      break;
  }
};

const handlePaymentIntent = async (stripeEvent: Stripe.Event) => {
  const paymentIntent = stripeEvent.data.object as Stripe.PaymentIntent;

  await upsertPaymentTransaction(paymentIntent);
  const userId = paymentIntent.metadata?.user_id;
  const attendeeId = paymentIntent.metadata?.attendee_id;
  const paymentType = paymentIntent.metadata?.payment_type;
  const paymentId = paymentIntent.id;
  switch (stripeEvent.type) {
    case "payment_intent.succeeded":
      // Event payments register through checkout.session.completed
      if (paymentType === "membership" && userId) {
        const { error } = await UserRepository.updateUser(userId, {
          is_payment_verified: true,
        });
        if (error) {
          console.error("User verify update err:", error);
          return;
        }
        console.log(
          `Membership PaymentIntent for ${userId} succeeded: ${paymentIntent.id}`
        );
        sendEmail(userId, LoopsEvent.MembershipPayment);
      }
      break;
    case "payment_intent.processing":
      // Only events without review track a pending payment on the attendee;
      // reviewed students stay Accepted and the page reads the checkout instead
      if (paymentType === "event" && attendeeId) {
        const attendee = await getAttendeeWithEvent(attendeeId);
        if (attendee && !attendee.Event.needs_review && attendee.status === "PROCESSING") {
          await updateAttendee(attendeeId, { is_payment_verified: false, payment_id: paymentId });
        }
      }
      break;
  }
};

const handleCheckoutSession = async (stripeEvent: Stripe.Event) => {
  const checkoutSession = stripeEvent.data.object as Stripe.Checkout.Session;
  const checkoutId = checkoutSession.id;
  const userId = checkoutSession.metadata?.user_id;
  const attendeeId = checkoutSession.metadata?.attendee_id;
  const paymentType = checkoutSession.metadata?.payment_type;
  if (paymentType === "membership") return;

  if (!userId || !attendeeId || !paymentType) {
    console.error("Missing required info! " + checkoutId);
    return;
  }
  switch (stripeEvent.type) {
    case "checkout.session.completed":
      await fulfillEventCheckout(stripeEvent, checkoutSession, attendeeId, userId);
      break;
    case "checkout.session.expired": {
      // Only the attendee's current checkout counts; an older one was replaced on purpose
      const { data: current } = await CheckoutSessionRepository.getCheckoutSession(attendeeId);
      if (current?.checkout_id !== checkoutId || current.fulfilled_at) return;
      // Events without review drop the unpaid application; reviewed students keep
      // their acceptance and can start a new checkout inside their window
      const attendee = await getAttendeeWithEvent(attendeeId);
      if (attendee && !attendee.Event.needs_review && attendee.status === "PROCESSING") {
        await deleteCheckoutSession(attendeeId);
        await deleteAttendee(attendeeId);
      }
      break;
    }
  }
};

// The database decides, under the event lock, whether this checkout registers
// the student (fulfill_event_checkout). When it can't, the reason is recorded
// first, then the payment is refunded once: the idempotency key makes a retried
// webhook reuse the same refund, and refund_id is recorded once Stripe has it.
const fulfillEventCheckout = async (
  stripeEvent: Stripe.Event,
  checkoutSession: Stripe.Checkout.Session,
  attendeeId: string,
  userId: string
) => {
  const checkoutId = checkoutSession.id;
  const paid = checkoutSession.payment_status === "paid" || checkoutSession.payment_status === "no_payment_required";
  const paymentIntentId =
    typeof checkoutSession.payment_intent === "string" ? checkoutSession.payment_intent : checkoutSession.payment_intent?.id;
  // Free checkouts have no payment intent; the checkout id stands in, as before
  const paymentId = paymentIntentId ?? checkoutId;

  // Attendee.payment_id points at Payment, so the row has to exist first
  if (paid) {
    await logTransaction({
      payment_id: paymentId,
      user_id: userId,
      type: "event",
      amount: checkoutSession.amount_total || 0,
      status: Status.PAYMENT_SUCCESS,
      payment_date: new Date().toISOString(),
    });
  }

  const { data: outcome, error } = await CheckoutSessionRepository.fulfill(
    checkoutId,
    stripeEvent.id,
    paid,
    new Date(stripeEvent.created * 1000).toISOString(),
    paymentId
  );
  if (error) throw new Error(`Failed to fulfill checkout ${checkoutId}: ${error.message}`);

  switch (outcome) {
    case "REGISTERED":
      addToMailingList(attendeeId);
      return;
    case "ALREADY_FULFILLED":
    case "UNPAID":
      return;
    case "NOT_FOUND":
      if (paid) logEvent("UNKNOWN_CHECKOUT", { attendeeId, checkoutId });
      return;
  }

  // An attention reason: refund it (free checkouts have nothing to refund)
  logEvent("PAYMENT_REFUND_REQUIRED", { reason: outcome as string, attendeeId, checkoutId });
  if (!paymentIntentId || !checkoutSession.amount_total) return;
  const refund = await stripe.refunds.create(
    { payment_intent: paymentIntentId },
    { idempotencyKey: `refund-${checkoutId}` }
  );
  const { error: refundError } = await CheckoutSessionRepository.recordRefund(checkoutId, refund.id);
  if (refundError) throw new Error(`Refunded ${checkoutId} but couldn't record ${refund.id}: ${refundError.message}`);
};

// helper functions
const mapTransactionStatus = (
  transaction: Stripe.PaymentIntent | Stripe.Checkout.Session
): Status => {
  switch (transaction.status) {
    case "complete":
    case "succeeded":
      return Status.PAYMENT_SUCCESS;
    case "processing":
      return Status.PAYMENT_PENDING;
    case "canceled":
      return Status.PAYMENT_CANCELED;
    case "requires_payment_method":
      return Status.PAYMENT_FAILED;
    default:
      return Status.PAYMENT_PENDING;
  }
};

const upsertPaymentTransaction = async (
  transaction: Stripe.PaymentIntent | Stripe.Checkout.Session
) => {
  const userId = transaction.metadata?.user_id;
  const paymentType = transaction.metadata?.payment_type;

  if (!userId) {
    console.error("Missing user_id in PaymentIntent metadata", transaction.id);
    return;
  } else if (!paymentType) {
    console.error(
      "Missing paymentType in PaymentIntent metadata",
      transaction.id
    );
    return;
  }

  const row: Tables<"Payment"> = {
    payment_id: transaction.id,
    user_id: userId,
    type: paymentType,
    amount:
      transaction.object === "checkout.session"
        ? transaction.amount_total || 0
        : transaction.amount,
    status: mapTransactionStatus(transaction),
    payment_date: new Date().toISOString(),
  };

  await logTransaction(row);
};

export const logTransaction = async (transaction: Tables<"Payment">) => {
  const { data: payment, error } = await PaymentRepository.logTransaction(
    transaction
  );
  if (error) throw new Error(error.message);
  return payment;
};
