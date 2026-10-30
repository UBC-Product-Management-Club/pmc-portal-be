import { stripe } from "../../config/stripe";
import { fetchMembershipPriceId } from "../Product/ProductService";
import Stripe from "stripe";
import { PaymentRepository } from "../../storage/PaymentRepository";
import { UserRepository } from "../../storage/UserRepository";
import { CheckoutSessionRepository } from "../../storage/CheckoutSessionRepository";
import { addToMailingList, LoopsEvent, sendEmail } from "../Email/EmailService";
import { Enums, Tables } from "../../schema/v2/database.types";
import moment from "moment";
import {
  deleteAttendee,
  getAttendee,
  getAttendeeWithEvent,
  registerIfSeatAvailable,
  updateAttendee,
} from "../Attendee/AttendeeService";
import { getEvent } from "../Event/EventService";

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

export const saveCheckoutSession = async (
  attendeeId: string,
  checkoutId: string
) => {
  const { error } = await CheckoutSessionRepository.addCheckoutSession(
    attendeeId,
    checkoutId
  );
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

export const deleteCheckoutSession = async (attendeeId: string) => {
  const { error } = await CheckoutSessionRepository.deleteCheckoutSession(
    attendeeId
  );
  if (error) {
    throw new Error(error.message);
  }
};

export const getOrCreateEventCheckoutSession = async (
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
      success_url: `${process.env.ORIGIN}/events/${eventId}/register?success=true`,
      cancel_url: `${process.env.ORIGIN}/events/${eventId}/register`, // you cant actually cancel a checkout session.
      expires_at: moment().unix() + 1900, // 30 minutes
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
    saveCheckoutSession(attendeeId, session.id);
    return session;
  } catch (error: any) {
    console.error(error);
    throw error;
  }
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
    saveCheckoutSession(attendeeId, session.id);
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
    case "payment_intent.succeeded": {
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
      } else if (paymentType === "event" && attendeeId) {
        await registerPaidAttendee(attendeeId, paymentId);
      }
      break;
    }
    case "payment_intent.payment_failed":
      if (paymentType === "event") {
        const attendee = await getAttendee(attendeeId, userId);
        if (!attendee) return;
        const event = await getEvent(attendee.event_id);
        if (event?.needs_review) {
          updateAttendee(attendeeId, {
            is_payment_verified: false,
            payment_id: paymentId,
            status: "ACCEPTED",
          });
        }
      }
      break;
    case "payment_intent.processing":
      if (paymentType === "event") {
        await updateAttendee(attendeeId, {
          is_payment_verified: false,
          payment_id: paymentId,
          status: "PROCESSING",
        });
      }
      break;
  }
};

const handleCheckoutSession = async (stripeEvent: Stripe.Event) => {
  const checkoutSession = stripeEvent.data.object as Stripe.Checkout.Session;
  const paymentId = checkoutSession.id;
  const userId = checkoutSession.metadata?.user_id;
  const attendeeId = checkoutSession.metadata?.attendee_id;
  const paymentType = checkoutSession.metadata?.payment_type;
  if (paymentType === "membership") return;

  if (!userId || !attendeeId || !paymentType) {
    console.error("Missing required info! " + paymentId);
    return;
  }
  switch (stripeEvent.type) {
    case "checkout.session.completed":
      // work around for free events: a $0 checkout claims a seat the same way
      if (checkoutSession.amount_total === 0) {
        await upsertPaymentTransaction(checkoutSession);
        if (!(await registerIfSeatAvailable(attendeeId, paymentId))) {
          logEvent("FREE_EVENT_FULL", { attendeeId, checkoutId: paymentId });
          await deleteCheckoutSession(attendeeId);
          await deleteAttendee(attendeeId);
          return;
        }
      }

      try {
        deleteCheckoutSession(attendeeId);
        addToMailingList(attendeeId);
        console.log(
          `Added user ${userId} to mailing list for event attendee ${attendeeId}`
        );
      } catch (error) {
        console.error("Failed to add to mailing list: ", error);
      }
      break;
    case "checkout.session.expired":
      deleteAttendee(attendeeId);
      deleteCheckoutSession(attendeeId);
      break;
  }
};

// Events without review don't hold a seat while a payment is pending, so the seat
// is claimed when the payment succeeds. If the event filled up meanwhile, the
// payment is refunded once (the idempotency key makes a retried webhook a no-op)
// and the application is removed so the student sees the event as full.
// Reviewed events keep their seat from acceptance; the applicant review PR adds
// their payment-hold checks.
const registerPaidAttendee = async (attendeeId: string, paymentIntentId: string) => {
  const attendee = await getAttendeeWithEvent(attendeeId);
  if (!attendee) {
    console.error(`Paid attendee ${attendeeId} not found`);
    return;
  }
  if (attendee.Event.needs_review) {
    await updateAttendee(attendeeId, {
      is_payment_verified: true,
      payment_id: paymentIntentId,
      status: "REGISTERED",
    });
    return;
  }
  if (await registerIfSeatAvailable(attendeeId, paymentIntentId)) return;

  await stripe.refunds.create(
    { payment_intent: paymentIntentId },
    { idempotencyKey: `refund-event-full-${paymentIntentId}` }
  );
  logEvent("NO_REVIEW_FULL", { attendeeId, paymentIntentId });
  await deleteCheckoutSession(attendeeId);
  await deleteAttendee(attendeeId);
};

// One JSON line per notable event, so Cloud Run log alerts can match on it
const logEvent = (event: string, details: Record<string, string>) =>
  console.error(JSON.stringify({ event, ...details }));

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
