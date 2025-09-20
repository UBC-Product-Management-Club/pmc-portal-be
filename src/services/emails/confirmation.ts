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

const addToMailingList = async (userId: string, attendeeId: string) => {
    try {
        const { data, error } = await supabase
            .from("Attendee")
            .select(
                `
                User!inner ( email ),
                Event!inner ( mailing_list )
                `
            )
            .eq("attendee_id", attendeeId)
            .single();

        if (error || !data) {
            throw new Error("Attendee or associated User/Event not found: " + error?.message);
        }

        if (!data.Event.mailing_list) {
            throw new Error("Event does not have a mailing list configured.");
        }

        const resp = await loops.updateContact(data.User.email, {}, { [data.Event.mailing_list]: true });

        console.log("Added to mailing list successfully:", resp);
    } catch (error) {
        console.error("Error adding to mailing list:", error);
        throw new Error("Failed to add to mailing list");
    }
};

export { ConfirmationEvent, sendConfirmationEmail, addToMailingList };
