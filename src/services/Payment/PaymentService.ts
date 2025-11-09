import { stripe } from "../../config/stripe";
import { fetchMembershipPriceId } from "../Product/ProductService";
import Stripe from "stripe";
import { PaymentRepository } from "../../storage/PaymentRepository";
import { UserRepository } from "../../storage/UserRepository";
import { CheckoutSessionRepository } from "../../storage/CheckoutSessionRepository";
import { AttendeeRepository } from "../../storage/AttendeeRepository";
import {
  addToMailingList,
  LoopsEvent,
  sendEmail,
} from "../Email/EmailService";
import { Enums, Tables } from "../../schema/v2/database.types";

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
    const existing = await getCheckoutSession(attendeeId)
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
    saveCheckoutSession(attendeeId, session.id)
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
    const existing = await getCheckoutSession(attendeeId)
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
    saveCheckoutSession(attendeeId, session.id)
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

  await logTransaction({
    payment_id: paymentIntent.id,
    user_id: paymentIntent.metadata?.user_id,
    type: paymentIntent.metadata?.payment_type,
    amount: paymentIntent.amount,
    status: mapTransactionStatus(paymentIntent),
    payment_date: new Date().toISOString(),
  });

  switch (stripeEvent.type) {
    case "payment_intent.succeeded": {
      const userId = paymentIntent.metadata?.user_id;
      const attendeeId = paymentIntent.metadata?.attendee_id;
      const paymentType = paymentIntent.metadata?.payment_type;
      const paymentId = paymentIntent.id;

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
        updateAttendee(attendeeId, paymentId, "REGISTERED");
      }
      break;
    }
    default:
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
      // work around for free events
      if (checkoutSession.amount_total === 0) {
        upsertPaymentTransaction(checkoutSession);
        updateAttendee(attendeeId, paymentId, "REGISTERED")
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
      AttendeeRepository.deleteAttendee(attendeeId);
      deleteCheckoutSession(attendeeId);
      break;
  }
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

const updateAttendee = async (
  attendeeId: string,
  paymentId: string,
  status: Enums<"ATTENDEE_STATUS">
) => {
  const { error } = await AttendeeRepository.updateAttendee(attendeeId, {
    is_payment_verified: true,
    payment_id: paymentId,
    status: status,
  });
  if (error)
    console.error(`Failed to update attendee ${attendeeId}! ${error.message}`);
  console.log(`Payment ${paymentId} succeeded for attendee ${attendeeId}`);
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
  if (error) throw error;
  return payment;
};
