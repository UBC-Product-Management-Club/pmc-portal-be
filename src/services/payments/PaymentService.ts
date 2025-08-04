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

async function createEventPaymentIntent(eventId: string) {

}

async function createMembershipPaymentIntent(userId: string) {

    const {data, error} = await supabase
        .from('User')
        .select('university')
        .eq('user_id', userId)
        .single()

    if (error) {
        throw new Error(error.message);
    }

    const isUBC = data.university === 'University of British Columbia'
    const amount = isUBC ? MEMBERSHIP_FEE_UBC : MEMBERSHIP_FEE_NONUBC;

    const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "cad",
    });

    const paymentInsertion : PaymentInsert = {
        amount,
        payment_date: new Date().toISOString(),
        payment_id: paymentIntent.id,
        type: "membership",
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

export { MEMBERSHIP_FEE_UBC, MEMBERSHIP_FEE_NONUBC, createMembershipPaymentIntent}