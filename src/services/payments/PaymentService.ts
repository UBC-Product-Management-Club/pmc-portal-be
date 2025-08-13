import { stripe } from "../../config/firebase";
import { supabase } from "../../config/supabase";
import { Database } from "../../schema/v2/database.types";
import Stripe from "stripe";

type PaymentInsert = Database["public"]["Tables"]["Payment"]["Insert"];

export enum Status {
    PAYMENT_SUCCESS = "PAYMENT_SUCCESS",
    PAYMENT_FAILED = "PAYMENT_FAILED",
    PAYMENT_PENDING = "PAYMENT_PENDING",
}

// in cents
const MEMBERSHIP_FEE_UBC = 1067;
const MEMBERSHIP_FEE_NONUBC = 1567;

async function createEventPaymentIntent(eventId: string) {}

async function createMembershipPaymentIntent(userId: string) {
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

    const paymentInsertion: PaymentInsert = {
        amount,
        payment_date: new Date().toISOString(),
        payment_id: paymentIntent.id,
        type: "membership",
        user_id: userId,
        status: Status.PAYMENT_PENDING,
    };

    const { data: payment, error: paymentError } = await supabase.from("Payment").insert(paymentInsertion).select().single();

    if (paymentError) {
        throw new Error(paymentError.message);
    }

    return paymentIntent;
}

async function handleStripeEvent(event: Stripe.Event) {
    switch (event.type) {
        case "payment_intent.succeeded": {
            const paymentIntent = event.data.object as Stripe.PaymentIntent;
            const userId = paymentIntent.metadata?.user_id;
            const paymentType = paymentIntent.metadata?.payment_type;

            const { error } = await supabase.from("Payment").update({ status: Status.PAYMENT_SUCCESS }).eq("payment_id", paymentIntent.id);
            if (error) {
                console.error("Payment success update err:", error);
            }

            if (paymentType === "membership") {
                const { error } = await supabase.from("User").update({ is_payment_verified: true }).eq("user_id", userId);
                if (error) {
                    console.error("User verify update err:", error);
                }

                console.log(`Membership PaymentIntent for ${userId} succeeded: ${paymentIntent.id}`);
            }

            break;
        }

        case "payment_intent.canceled": {
            break;
        }

        case "payment_intent.processing": {
            break;
        }

        case "payment_intent.payment_failed": {
            const paymentIntent = event.data.object as Stripe.PaymentIntent;
            const userId = paymentIntent.metadata?.user_id;
            const paymentType = paymentIntent.metadata?.payment_type;

            if (paymentType === "membership") {
                const { error } = await supabase.from("Payment").update({ status: Status.PAYMENT_FAILED }).eq("payment_id", paymentIntent.id);
                if (error) {
                    console.error("Payment fail update err:", error);
                }

                console.log(`Membership PaymentIntent for ${userId} failed: ${paymentIntent.id}`);
            }

            break;
        }
        default:
        // console.log(`Unhandled event type ${event.type}`);
    }
}

export { MEMBERSHIP_FEE_UBC, MEMBERSHIP_FEE_NONUBC, createMembershipPaymentIntent, handleStripeEvent };
