import { loops } from "../../config/loops";
import { supabase } from "../../config/supabase";

enum ConfirmationEvent {
    MembershipPayment = "membership_payment",
    EventPayment = "event_payment",
}

const sendConfirmationEmail = async (userId: string, type: ConfirmationEvent) => {
    try {
        const { data, error } = await supabase.from("User").select("email").eq("user_id", userId).single();

        if (error || !data) {
            throw new Error("User email not found: " + error?.message);
        }

        const resp = await loops.sendEvent({
            email: data.email,
            eventName: type,
        });

        console.log("Confirmation " + type + " email sent successfully:", resp);
    } catch (error) {
        console.error("Error sending confirmation email:", error);
        throw new Error("Failed to send confirmation email");
    }
};

export { ConfirmationEvent, sendConfirmationEmail };
