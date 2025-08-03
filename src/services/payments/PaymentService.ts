import { date } from "zod";
import { stripe } from "../../config/firebase"
import { supabase } from "../../config/supabase"
import { Database } from "../../schema/v2/database.types";

type PaymentInsert = Database['public']['Tables']['Payment']['Insert'];
enum Status {
  PAYMENT_SUCCESS = "PAYMENT_SUCCESS",
  PAYMENT_FAILED = "PAYMENT_FAILED",
  PAYMENT_PENDING = "PAYMENT_PENDING",
}

// in cents
const MEMBERSHIP_FEE_UBC = 1067
const MEMBERSHIP_FEE_NONUBC = 1567

async function createMembershipPaymentIntent(isUbc: boolean) {
    return await stripe.paymentIntents.create({
        amount: isUbc ? MEMBERSHIP_FEE_UBC : MEMBERSHIP_FEE_NONUBC,
        currency: 'cad'
    })
}

async function createEventPaymentIntent(eventId: string) {

}

async function createPaymentIntent(userId: string, type: "event" | "membership", eventId?: string) {

    const {data: userVerify, error :userError } = await supabase
        .from('User')
        .select('is_payment_verified')
        .eq('user_id', userId)
        .single()

    if (userError) {
        throw new Error(userError.message);
    }

    const isMember = userVerify.is_payment_verified;

    let amount;

    if (type === "event" && eventId) {

        const { data, error } = await supabase
                .from('Event')
                .select('member_price, non_member_price')
                .eq('event_id', eventId)
                .single();
        if (error) {
            throw new Error(error.message);
        }

        amount = isMember ? data.member_price : data.non_member_price;

    } else if (type === "membership") {
        const {data, error} = await supabase
            .from('User')
            .select('university')
            .eq('user_id', userId)
            .single()

        if (error) {
            throw new Error(error.message);
        }

        const isUBC = data.university === 'University of British Columbia'
        amount = isUBC ? MEMBERSHIP_FEE_UBC : MEMBERSHIP_FEE_NONUBC;
    } else {
        throw new Error("Invalid payment type or missing eventId");
    }

    const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "cad",
    });

    const paymentInsertion : PaymentInsert = {
        amount,
        payment_date: new Date().toISOString(),
        payment_id: paymentIntent.id,
        type,
        user_id: userId,
        status: Status.PAYMENT_PENDING,
    };

    const {data: payment, error:paymentError} = await supabase
        .from('Payment')
        .insert(paymentInsertion)
        .select()
        .single()

    if (paymentError) {
        throw new Error(paymentError.message)
    }
    
    return paymentIntent
}

export { MEMBERSHIP_FEE_UBC, MEMBERSHIP_FEE_NONUBC, createMembershipPaymentIntent, createPaymentIntent}