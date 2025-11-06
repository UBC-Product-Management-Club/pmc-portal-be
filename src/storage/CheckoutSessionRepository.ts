import { supabase } from "../config/supabase";

export const CheckoutSessionRepository = {
    addCheckoutSession: (attendeeId: string, checkoutId: string) => supabase.from("Checkout_Session").insert({ attendee_id: attendeeId, checkout_id: checkoutId}),
    getCheckoutSession: (attendeeId: string) => supabase.from("Checkout_Session").select("checkout_id").eq("attendee_id", attendeeId).single(),
    deleteCheckoutSession: (attendeeId: string) => supabase.from("Checkout_Session").delete().eq("attendee_id", attendeeId)

}