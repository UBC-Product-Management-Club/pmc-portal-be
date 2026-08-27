import { supabase } from "../config/supabase";

// Read-only access to the recruiting form definitions. Questions now live in
// jsonb on the cycle (general) and the role (role-specific), so fetching a
// cycle or a role brings its questions with it -- there are no separate
// question queries any more.
export const RecruitingRepository = {
    // At most one cycle is active at a time (enforced by a partial unique
    // index). No active cycle means applications are closed.
    getActiveCycle: () =>
        supabase.from("Recruiting_Cycle").select("*").eq("is_active", true).maybeSingle(),

    getRolesForCycle: (cycleId: string) =>
        supabase
            .from("Recruiting_Role")
            .select("role_id, cycle_id, name, team")
            .eq("cycle_id", cycleId)
            .eq("is_active", true)
            .order("name"),

    // Includes `questions`, unlike the list query above.
    getRole: (roleId: string) =>
        supabase.from("Recruiting_Role").select("*").eq("role_id", roleId).maybeSingle(),
};
