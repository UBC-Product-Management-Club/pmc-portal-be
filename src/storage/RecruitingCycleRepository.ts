import { supabase } from "../config/supabase";

// Hiring cycles (e.g. "Spring '26 Exec Hiring"). Execs manage rows in the
// Supabase table editor; the active cycle is whichever row has is_active = true.
export const RecruitingCycleRepository = {
    getActiveCycle: () => supabase.from("Recruiting_Cycle").select("*").eq("is_active", true).limit(1).maybeSingle(),
    getCycles: () => supabase.from("Recruiting_Cycle").select("*").order("created_at", { ascending: false }),
};
