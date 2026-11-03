import { supabase } from "../config/supabase";
import { Json } from "../schema/v2/database.types";

// The window, roster and version rules live in these functions
// (20261030000000_submissions.sql)
export const SubmissionRepository = {
    getPhases: (eventId: string, userId: string) => supabase.rpc("submission_phases", { p_event_id: eventId, p_user_id: userId }),
    getSubmission: (eventId: string, userId: string, phaseId: string) =>
        supabase.rpc("team_submission", { p_event_id: eventId, p_user_id: userId, p_phase_id: phaseId }),
    getContext: (eventId: string, userId: string, phaseId: string) =>
        supabase.rpc("submission_context", { p_event_id: eventId, p_user_id: userId, p_phase_id: phaseId }),
    save: (eventId: string, userId: string, phaseId: string, submission: Json, expectedVersion: number) =>
        supabase.rpc("save_submission", {
            p_event_id: eventId,
            p_user_id: userId,
            p_phase_id: phaseId,
            p_submission: submission,
            p_expected_version: expectedVersion,
        }),
};
