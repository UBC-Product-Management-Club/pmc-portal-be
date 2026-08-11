import { supabase } from "../config/supabase";

// Read-only access to the recruiting form definitions. Questions live in jsonb
// on the cycle (general) and the role (role-specific), so fetching either one
// brings its questions with it -- there are no separate question queries.
export const RecruitingRepository = {
    // At most one cycle is active at a time (enforced by a partial unique
    // index). No active cycle means applications are closed.
    getActiveCycle: () =>
        supabase
            .from("Recruiting_Cycle")
            .select("*")
            .eq("is_active", true)
            .maybeSingle(),

    getRolesForCycle: (cycleId: string) =>
        supabase
            .from("Recruiting_Role")
            .select("role_id, cycle_id, name, team")
            .eq("cycle_id", cycleId)
            .eq("is_active", true)
            .order("name"),

    // Includes `questions`, unlike the list query above.
    // The cycle the admin portal is working on, active or not. The applicant
    // side only ever wants the active one; an exec still needs to see a cycle
    // that has not been opened yet, or has already closed.
    getLatestCycle: () =>
        supabase
            .from("Recruiting_Cycle")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),

    // Every role on a cycle, including deactivated ones, so the viewer's role
    // filter still resolves applications made against a role since retired.
    getAllRolesForCycle: (cycleId: string) =>
        supabase
            .from("Recruiting_Role")
            .select("role_id, cycle_id, name, team, is_active")
            .eq("cycle_id", cycleId)
            .order("name"),

    getRole: (roleId: string) =>
        supabase.from("Recruiting_Role").select("*").eq("role_id", roleId).maybeSingle(),
};
