import { supabase } from "../config/supabase";
import { TablesInsert } from "../schema/v2/database.types";

type Application = TablesInsert<"Recruiting_Application">;

export const ApplicationRepository = {
    // One row per applicant per role, so writing an application is an upsert on
    // that constraint rather than an insert.
    upsertApplication: (application: Application) =>
        supabase
            .from("Recruiting_Application")
            .upsert(application, { onConflict: "user_id,role_id" })
            .select()
            .single(),

    // The applicant's own row for one role -- used to tell whether they have
    // already submitted.
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
