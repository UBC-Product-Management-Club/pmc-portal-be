import { supabase } from "../config/supabase";
import { TablesInsert, TablesUpdate } from "../schema/v2/database.types";

type Application = TablesInsert<"Recruiting_Application">;
type ApplicationUpdate = TablesUpdate<"Recruiting_Application">;

// The applicant's name and email come from User rather than their answers, so
// the admin viewer can search on indexed columns. Role name and team come along
// for display and team filtering.
const WITH_APPLICANT_AND_ROLE =
    "*, User(first_name, last_name, email), Recruiting_Role(name, team)";

export const ApplicationRepository = {
    // Drafts and submissions are the same row, so creating and saving are both
    // an upsert on the one-application-per-role constraint.
    upsertApplication: (application: Application) =>
        supabase
            .from("Recruiting_Application")
            .upsert(application, { onConflict: "user_id,role_id" })
            .select()
            .single(),

    updateApplication: (applicationId: string, updates: ApplicationUpdate) =>
        supabase
            .from("Recruiting_Application")
            .update(updates)
            .eq("application_id", applicationId)
            .select()
            .maybeSingle(),

    getApplication: (applicationId: string) =>
        supabase
            .from("Recruiting_Application")
            .select(WITH_APPLICANT_AND_ROLE)
            .eq("application_id", applicationId)
            .maybeSingle(),

    // The applicant's own row for one role -- used to load a draft back into
    // the form, and to tell whether they have already submitted.
    getApplicationForRole: (userId: string, roleId: string) =>
        supabase
            .from("Recruiting_Application")
            .select("*")
            .eq("user_id", userId)
            .eq("role_id", roleId)
            .maybeSingle(),

    // An applicant may hold one application per role, so this is a list.
    getApplicationsByUser: (userId: string) =>
        supabase
            .from("Recruiting_Application")
            .select("*, Recruiting_Role(name, team)")
            .eq("user_id", userId)
            .order("created_at", { ascending: false }),
};
