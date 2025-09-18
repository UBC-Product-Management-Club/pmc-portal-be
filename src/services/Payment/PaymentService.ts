import { stripe } from "../../config/stripe";
import { supabase } from "../../config/supabase";
import { Database } from "../../schema/v2/database.types";
import { fetchMembershipPriceId } from "../Product/ProductService";
import { getEventPriceId } from "../Event/EventService";
import Stripe from "stripe";
import { ConfirmationEvent, sendConfirmationEmail } from "../emails/confirmation";

type PaymentInsert = Database["public"]["Tables"]["Payment"]["Insert"];

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
    const { data, error } = await supabase.from("User").select("university").eq("user_id", userId).single();

    if (error) {
        throw new Error(error.message);
    }

    const isUBC = data.university === "University of British Columbia";
    const amount = isUBC ? MEMBERSHIP_FEE_UBC : MEMBERSHIP_FEE_NONUBC;

    const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "cad",
        metadata: {
            user_id: userId,
            payment_type: "membership",
        },
    });

    return paymentIntent;
};

export const createCheckoutSession = async (userId: string) => {
    const { data, error } = await supabase.from("User").select("university").eq("user_id", userId).single();

    if (error) {
        throw new Error(error.message);
    }

    const isUBC = data.university === "University of British Columbia";

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

    return session
}

export const createEventCheckoutSession = async (userId: string, eventId: string, attendeeId: string) => {
    const { data, error } = await supabase.from("User").select("is_payment_verified").eq("user_id", userId).single();

    if (error) {
        throw new Error(error.message);
    }

    const isMember = data.is_payment_verified ?? false;

    try {
        const priceId = await getEventPriceId(eventId, isMember);
        const session = await stripe.checkout.sessions.create({
            line_items: [
            {
                price: priceId,
                quantity: 1,
            },
            ],
            mode: 'payment',
            payment_method_configuration: process.env.CARD_PAYMENT_METHOD_ID,
            success_url: `${process.env.ORIGIN}/events/${eventId}/register/?attendeeId=${attendeeId}&success=true`,
            cancel_url: `${process.env.ORIGIN}/events/${eventId}/register/?attendeeId=${attendeeId}&canceled=true`,
            metadata: {
                user_id: userId,
                payment_type: "event",
                attendee_id: attendeeId
            },
            payment_intent_data: {
                metadata: {
                    user_id: userId,
                    payment_type: "event",
                    attendee_id: attendeeId
                },
            },
        });
        return session

    } catch (error: any) {
        console.log(error.message);
        throw new Error(error.message);
    }
}

export const handleStripeEvent = async (event: Stripe.Event) => {
    const stripeEventType = event.type;

    // console.log(stripeEventType);
    switch (stripeEventType) {
        case "checkout.session.completed":
            await handleCheckoutSession(event)
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
 
    switch (stripeEvent.type) {
        case "payment_intent.succeeded": {
            const userId = paymentIntent.metadata?.user_id;
            const attendeeId = paymentIntent.metadata?.attendee_id;
            const paymentType = paymentIntent.metadata?.payment_type;
            const paymentId = paymentIntent.id;

            if (paymentType === "membership" && userId) {
                const { error } = await supabase.from("User").update({ is_payment_verified: true }).eq("user_id", userId);
                if (error) {
                    console.error("User verify update err:", error);
                    return;
                }
                console.log(`Membership PaymentIntent for ${userId} succeeded: ${paymentIntent.id}`);
                await sendConfirmationEmail(userId, ConfirmationEvent.MembershipPayment);
            } else if (paymentType === "event" && attendeeId) {
                const { error } = await supabase.from("Attendee").update({ is_payment_verified: true, payment_id: paymentId}).eq("attendee_id", attendeeId);
                if (error) {
                    console.error("Attendee verify update err:", error);
                    return;
                }
                console.log(`Event PaymentIntent for ${attendeeId} succeeded: ${paymentIntent.id}`);
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

    if (!userId || !attendeeId || !paymentType) {
        console.error("Missing required info! " + paymentId);
        return;
    }
    
    // work around for free events
    if (checkoutSession.amount_total === 0) {
        await upsertPaymentTransaction(checkoutSession)
        const { error } = await supabase.from("Attendee").update({ is_payment_verified: true, payment_id: paymentId}).eq("attendee_id", attendeeId);
        if (error) console.error(`Failed to update attendee ${attendeeId}! ${error.message}`);
        console.log(`Payment ${paymentId} succeeded for attendee ${attendeeId}`)
    }
}

// helper functions
const mapTransactionStatus = (transaction: Stripe.PaymentIntent | Stripe.Checkout.Session): Status => {
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

const upsertPaymentTransaction = async (transaction: Stripe.PaymentIntent | Stripe.Checkout.Session) => {
    const userId = transaction.metadata?.user_id;
    const paymentType = transaction.metadata?.payment_type;

    if (!userId) {
        console.error("Missing user_id in PaymentIntent metadata", transaction.id);
        return;
    } else if (!paymentType) {
        console.error("Missing paymentType in PaymentIntent metadata", transaction.id);
        return;
    }

    const row: PaymentInsert = {
        payment_id: transaction.id,
        user_id: userId,
        type: paymentType,
        amount: transaction.object === "checkout.session" ? transaction.amount_total || 0 : transaction.amount,
        status: mapTransactionStatus(transaction),
        payment_date: new Date().toISOString(),
    };

    await logTransaction(row);
};

export const logTransaction = async (transaction: PaymentInsert) => {
    const { data: payment, error } = await supabase.from("Payment").upsert(transaction, { onConflict: "payment_id" }).select().single();
    if (error) throw error;
    return payment;
};
