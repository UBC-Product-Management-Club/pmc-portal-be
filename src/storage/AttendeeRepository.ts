import { supabase } from "../config/supabase";
import { Json } from "../schema/v2/database.types";

export const AttendeeRepository = {
    getAttendeeWithEvent: (attendeeId: string) =>
        supabase.from("Attendee").select("attendee_id, status, Event!inner ( event_id, needs_review )").eq("attendee_id", attendeeId).maybeSingle(),
    // Window, duplicate and cap checks plus the insert, in one locked transaction
    submitApplication: (eventId: string, userId: string, answers: Json) =>
        supabase.rpc("submit_application", { p_event_id: eventId, p_user_id: userId, p_answers: answers }).single(),
    // Registers only if a seat is free (free and no-review events)
    registerIfSeatAvailable: (attendeeId: string, paymentId?: string) =>
        supabase.rpc("register_if_seat_available", { p_attendee_id: attendeeId, ...(paymentId && { p_payment_id: paymentId }) }),
    getAttendee: (eventId: string, userId: string) => supabase.from("Attendee").select("*").eq("event_id", eventId).eq("user_id", userId).maybeSingle(),
    deleteAttendee: (attendeeId: string) => supabase.from("Attendee").delete().eq("attendee_id", attendeeId),
    countByEvent: (eventId: string) => supabase.from("Attendee").select("*", { count: "exact", head: true }).eq("event_id", eventId),
    updateAttendee: async (attendeeId: string, updates: Record<string, any>) => supabase.from("Attendee").update(updates).eq("attendee_id", attendeeId),
    getEmailAndMailingListByAttendee: async (attendeeId: string) =>
        supabase
            .from("Attendee")
            .select(
                `
        User!inner ( email ),
        Event!inner ( mailing_list )
        `
            )
            .eq("attendee_id", attendeeId)
            .single(),
};
