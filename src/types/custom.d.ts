import { Tables } from "../schema/v2/database.types";

declare global {
    namespace Express {
        interface Request {
            // The Auth0 session's User row, set by sessionFilter.
            user?: Tables<"User">
            // The verified Supabase Auth account, set by supabaseJwtCheck. This
            // is a separate identity system from req.user: the admin portal
            // signs in through Supabase, members through Auth0.
            supabaseUser?: { id: string; email: string }
            // The caller's allowlist row, set by requireAdmin. Its presence is
            // what proves the caller may be in the admin portal at all; `role`
            // is what requireVP checks.
            admin?: Tables<"Admin_Allowlist">
        }
    }
}