import { supabase } from "../config/supabase";
import { TablesInsert } from "../schema/v2/database.types";

type CheckoutSessionInsert = Pick<TablesInsert<"Checkout_Session">, "attendee_id" | "checkout_id" | "acceptance_version" | "expires_at">;

export const CheckoutSessionRepository = {
    // One row per attendee: a new checkout replaces the last one and clears how it was handled
    saveCheckoutSession: (row: CheckoutSessionInsert) =>
        supabase.from("Checkout_Session").upsert(
            { ...row, fulfilled_at: null, fulfilled_event_id: null, refund_id: null, attention_reason: null, attention_resolved_at: null },
            { onConflict: "attendee_id" }
        ),
    getCheckoutSession: (attendeeId: string) => supabase.from("Checkout_Session").select("checkout_id, acceptance_version, fulfilled_at, attention_reason, attention_resolved_at, refund_id").eq("attendee_id", attendeeId).maybeSingle(),
    deleteCheckoutSession: (attendeeId: string) => supabase.from("Checkout_Session").delete().eq("attendee_id", attendeeId),
    // Registers the student or names why the payment has to be refunded, under the event lock
    fulfill: (checkoutId: string, stripeEventId: string, paid: boolean, completedAt: string, paymentId: string) =>
        supabase.rpc("fulfill_event_checkout", {
            p_checkout_id: checkoutId,
            p_stripe_event_id: stripeEventId,
            p_paid: paid,
            p_completed_at: completedAt,
            p_payment_id: paymentId,
        }),
    recordRefund: (checkoutId: string, refundId: string) =>
        supabase.from("Checkout_Session").update({ refund_id: refundId }).eq("checkout_id", checkoutId),
}
