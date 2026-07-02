import { supabase } from "../config/supabase";
import { Enums, TablesInsert } from "../schema/v2/database.types";

type Application = TablesInsert<"Application">;

export const ApplicationRepository = {
    addApplication: (application: Application) => supabase.from("Application").insert(application).select().single(),
    getApplications: () => supabase.from("Application").select("*"),
    getApplicationById: (applicationId: string) => supabase.from("Application").select("*").eq("application_id", applicationId).maybeSingle(),
    getApplicationByUser: (userId: string) => supabase.from("Application").select("*").eq("user_id", userId).maybeSingle(),
    updateStatus: (applicationId: string, status: Enums<"APPLICATION_STATUS">) => supabase.from("Application").update({ status }).eq("application_id", applicationId).select().maybeSingle(),
};
