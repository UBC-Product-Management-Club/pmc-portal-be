import { supabase } from "../config/supabase";

// What tech's scripts read and change. Decisions only go through the database
// functions; nothing here edits an attendee row directly.
export const OpsRepository = {
    getEvent: (eventId: string) =>
        supabase.from("Event").select("event_id, name, max_attendees, needs_review").eq("event_id", eventId).maybeSingle(),
    seatsTaken: (eventId: string) => supabase.rpc("seats_taken", { p_event_id: eventId }),
    reviewSheetRows: (eventId: string) => supabase.rpc("review_sheet_rows", { p_event_id: eventId }),
    messagesDue: (eventId: string) => supabase.rpc("messages_due", { p_event_id: eventId }),
    paymentIssues: (eventId: string) => supabase.rpc("payment_issues", { p_event_id: eventId }),

    // The attendees a run touches, with their hooks, for checking before and after
    getAttendeeStates: (attendeeIds: string[]) =>
        supabase
            .from("Attendee")
            .select("attendee_id, event_id, status, acceptance_version, payment_due_at, reviewed_at, Notification_Hook ( type, acceptance_version )")
            .in("attendee_id", attendeeIds),

    acceptApplicants: (eventId: string, attendeeIds: string[], reviewer: string) =>
        supabase.rpc("accept_applicants", { p_event_id: eventId, p_attendee_ids: attendeeIds, p_reviewer: reviewer }),
    rejectApplicants: (eventId: string, attendeeIds: string[], reviewer: string) =>
        supabase.rpc("reject_applicants", { p_event_id: eventId, p_attendee_ids: attendeeIds, p_reviewer: reviewer }),
    reopenPaymentWindow: (eventId: string, attendeeIds: string[], reviewer: string) =>
        supabase.rpc("reopen_payment_window", { p_event_id: eventId, p_attendee_ids: attendeeIds, p_reviewer: reviewer }),

    // A send can be recorded even if the row was cancelled meanwhile; a row
    // already marked sent keeps its first record
    markSent: (notificationIds: string[], sentBy: string) =>
        supabase
            .from("Notification_Hook")
            .update({ sent_at: new Date().toISOString(), sent_by: sentBy, provider: "manual" })
            .in("notification_id", notificationIds)
            .is("sent_at", null)
            .select("notification_id"),
    getNotifications: (notificationIds: string[]) =>
        supabase.from("Notification_Hook").select("notification_id, sent_at").in("notification_id", notificationIds),

    setRefund: (checkoutId: string, refundId: string) =>
        supabase.from("Checkout_Session").update({ refund_id: refundId }).eq("checkout_id", checkoutId),
    resolveIssue: (checkoutId: string) =>
        supabase
            .from("Checkout_Session")
            .update({ attention_resolved_at: new Date().toISOString() })
            .eq("checkout_id", checkoutId)
            .not("attention_reason", "is", null)
            .is("attention_resolved_at", null)
            .select("checkout_id"),

    // Event day (20261031000000_event_day_ops.sql)
    extendPhase: (phaseId: string, until: string) => supabase.rpc("extend_phase_deadline", { p_phase_id: phaseId, p_until: until }),
    extendTeam: (eventId: string, teamCode: string, until: string) =>
        supabase.rpc("extend_team", { p_event_id: eventId, p_team_code: teamCode, p_until: until }),
    setFinalists: (eventId: string, teamCodes: string[], isFinalist: boolean, correction: boolean) =>
        supabase.rpc("set_finalists", { p_event_id: eventId, p_team_codes: teamCodes, p_is_finalist: isFinalist, p_correction: correction }),
    publishFinalists: (eventId: string, teamCodes: string[]) =>
        supabase.rpc("publish_finalists", { p_event_id: eventId, p_team_codes: teamCodes }),
    getFinalists: (eventId: string) =>
        supabase.from("Team").select("team_code, team_name").eq("event_id", eventId).eq("is_finalist", true).order("team_name"),
    getPhases: (eventId: string) =>
        supabase.from("Deliverable_Flags").select("id").eq("event_id", eventId),
    submissionExport: (phaseId: string) => supabase.rpc("submission_export", { p_phase_id: phaseId }),
    // A 7-day link to a private deck
    signDeliverable: (path: string) =>
        supabase.storage.from(process.env.SUPABASE_DELIVERABLES_BUCKET!).createSignedUrl(path, 7 * 24 * 60 * 60),

    // A 7-day link to a private resume
    signResume: (path: string) =>
        supabase.storage.from(process.env.SUPABASE_ATTENDEE_BUCKET_NAME!).createSignedUrl(path, 7 * 24 * 60 * 60),
};
