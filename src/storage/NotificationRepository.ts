import { supabase } from "../config/supabase";
import { Enums } from "../schema/v2/database.types";

export const NotificationRepository = {
    // The hook plus the attendee's state now, for re-checking before a send
    getHook: (notificationId: string) =>
        supabase
            .from("Notification_Hook")
            .select("*, Attendee!inner ( status, acceptance_version, payment_due_at )")
            .eq("notification_id", notificationId)
            .maybeSingle(),
    findHook: (attendeeId: string, type: Enums<"notification_type">, acceptanceVersion: number) =>
        supabase
            .from("Notification_Hook")
            .select("notification_id, sent_at")
            .eq("attendee_id", attendeeId)
            .eq("type", type)
            .eq("acceptance_version", acceptanceVersion)
            .maybeSingle(),
    // Only an unsent row is marked, so a second sender never overwrites the first
    markSent: (notificationId: string, provider: "loops" | "manual") =>
        supabase
            .from("Notification_Hook")
            .update({ sent_at: new Date().toISOString(), provider })
            .eq("notification_id", notificationId)
            .is("sent_at", null),
};
