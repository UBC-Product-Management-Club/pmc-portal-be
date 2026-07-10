import { supabase } from "../config/supabase";
import { Enums, TablesInsert } from "../schema/v2/database.types";

type ExecApplication = TablesInsert<"Exec_Application">;

// Applicant name is joined from User so the admin list/detail views can show it
// without extra round-trips (see recruiting dashboard #35/#36).
const WITH_APPLICANT = "*, User(first_name, last_name)";

export const ApplicationRepository = {
    addApplication: (application: ExecApplication) => supabase.from("Exec_Application").insert(application).select().single(),
    getApplications: (limit: number, offset: number) => supabase.from("Exec_Application").select(WITH_APPLICANT, { count: "exact" }).order("submitted_at", { ascending: false }).range(offset, offset + limit - 1),
    getApplicationById: (applicationId: string) => supabase.from("Exec_Application").select(WITH_APPLICANT).eq("application_id", applicationId).maybeSingle(),
    getApplicationsByUser: (userId: string) => supabase.from("Exec_Application").select("*").eq("user_id", userId).order("submitted_at", { ascending: false }),
    setStarred: (applicationId: string, isStarred: boolean) => supabase.from("Exec_Application").update({ is_starred: isStarred }).eq("application_id", applicationId).select().maybeSingle(),
    updateStatus: (applicationId: string, status: Enums<"APPLICATION_STATUS">) => supabase.from("Exec_Application").update({ status }).eq("application_id", applicationId),
};
