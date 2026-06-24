import { supabase } from "../config/supabase";
import { TablesInsert } from "../schema/v2/database.types";

type Application = TablesInsert<"Application">;

export const ApplicationRepository = {
    addApplication: (application: Application) => supabase.from("Application").insert(application).select().single(),
    getApplications: () => supabase.from("Application").select("*"),
    getApplicationById: (applicationId: string) => supabase.from("Application").select("*").eq("application_id", applicationId).maybeSingle(),
    getApplicationByUser: (userId: string) => supabase.from("Application").select("*").eq("user_id", userId).maybeSingle(),
};
