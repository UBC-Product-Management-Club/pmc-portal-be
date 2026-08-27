import { supabase } from "../config/supabase";

export const AdminAllowlistRepository = {
    // Looked up on every admin request, so the caller must pass an already
    // normalised (trimmed, lowercased) address -- email is the primary key and
    // this is an exact match. See the lowercase check constraint on the table
    // for why this cannot be an ilike.
    getByEmail: (email: string) =>
        supabase
            .from("Admin_Allowlist")
            .select("*")
            .eq("email", email)
            .maybeSingle(),
};
