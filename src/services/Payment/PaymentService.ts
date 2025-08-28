import { stripe } from "../../config/stripe";
import { supabase } from "../../config/supabase";
import { Database } from "../../schema/v2/database.types";
import { fetchMembershipPriceId } from "../Product/ProductService";
import Stripe from "stripe";
import { ConfirmationEvent, sendConfirmationEmail } from "../emails/confirmation";

type PaymentInsert = Database["public"]["Tables"]["Payment"]["Insert"];

const CARD_PAYMENT_METHOD_ID = "pmc_1RwtRfL4ingF9CfzbEtiSzOS";

export enum Status {
    PAYMENT_SUCCESS = "PAYMENT_SUCCESS",
    PAYMENT_FAILED = "PAYMENT_FAILED",
    PAYMENT_PENDING = "PAYMENT_PENDING",
}

// in cents
export const MEMBERSHIP_FEE_UBC = 1067;
export const MEMBERSHIP_FEE_NONUBC = 1567;

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

    const paymentInsertion: PaymentInsert = {
        amount,
        payment_date: new Date().toISOString(),
        payment_id: paymentIntent.id,
        type: "membership",
        user_id: userId,
        status: Status.PAYMENT_PENDING,
    };

    await logTransaction(paymentInsertion);

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
        payment_method_configuration: "pmc_1RwtRfL4ingF9CfzbEtiSzOS",

        success_url: `${process.env.ORIGIN}/dashboard/success`,
        cancel_url: `${process.env.ORIGIN}/dashboard/canceled`,
        metadata : {
            user_id: userId,
            payment_type: "membership"
        }
    });

    return session;
};

export const handleStripeEvent = async (event: Stripe.Event) => {
    const stripeEventType = event.data.object.object 

    console.log(stripeEventType)
    switch (stripeEventType) {
        case "checkout.session": {
            handleCheckoutSession(event)
            break
        }
        case "payment_intent": {
            handlePaymentIntent(event)
            break
        }
        default:
            //console.log(stripeEventType)
    }
}

const handlePaymentIntent = async (stripeEvent: Stripe.Event) => {
    const paymentIntent = stripeEvent.data.object as Stripe.PaymentIntent
    const userId = paymentIntent.metadata?.user_id;
    const paymentType = paymentIntent.metadata?.payment_type;

    switch (stripeEvent.type) {

        case "payment_intent.succeeded": {
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

                await sendConfirmationEmail(userId, ConfirmationEvent.MembershipPayment);
            }
            console.log(paymentIntent.id)
            break;
        }

        case "payment_intent.canceled": {
            break;
        }

        case "payment_intent.processing": {
            break;
        }

        case "payment_intent.payment_failed": {
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
};


const handleCheckoutSession = async (stripeEvent: Stripe.Event) => {
    const sessionIntent = stripeEvent.data.object as Stripe.Checkout.Session;
    const userId = sessionIntent.metadata?.user_id;
    const paymentType = sessionIntent.metadata?.payment_type;

    if (!userId) {
        throw new Error("user_id is missing in metadata!");
    }

    const { error } = await supabase.from("Payment").insert({ 
        payment_id: sessionIntent.payment_intent as string, 
        user_id: userId, 
        amount: sessionIntent.amount_total!, 
        status: Status.PAYMENT_SUCCESS, 
        payment_date: new Date().toISOString(),
        type: paymentType
    });

    if (error) {
        console.error("Payment success update err:", error);
        return
    }

    if (paymentType === "membership") {
        const { error } = await supabase.from("User").update({ is_payment_verified: true }).eq("user_id", userId);
        if (error) {
            console.error("User verify update err:", error);
            return
        }

        console.log(`Membership PaymentIntent for ${userId} succeeded: ${sessionIntent.id}`);
    }
}


export const logTransaction = async (transaction: PaymentInsert) => {
    const { data: payment, error } = await supabase.from("Payment").insert(transaction).select().single();
    if (error) throw error;
    return payment;
};
