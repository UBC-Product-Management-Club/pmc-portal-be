import { supabase } from "../config/supabase";
import { Enums, TablesInsert, TablesUpdate } from "../schema/v2/database.types";

type Application = TablesInsert<"Recruiting_Application">;
type ApplicationUpdate = TablesUpdate<"Recruiting_Application">;

export interface ApplicationListFilters {
    cycleId: string;
    status?: Enums<"APPLICATION_STATUS">;
    roleId?: string;
    team?: Enums<"RECRUITING_TEAM">;
    search?: string;
    // Drafts are half-finished and belong to the applicant, so the viewer hides
    // them unless asked.
    includeDrafts?: boolean;
}

// The search term is interpolated into a PostgREST filter string, where `%` and
// `_` are LIKE wildcards and `,` `.` `(` `)` are grammar. Names and emails need
// none of those, so anything else is dropped rather than escaped.
const sanitizeSearch = (term: string) => term.replace(/[^A-Za-z0-9 @'-]/g, "");

// The applicant's name and email come from User rather than their answers, so
// the admin viewer can search on indexed columns. Role name and team come along
// for display and team filtering.
const WITH_APPLICANT_AND_ROLE =
    "*, User(first_name, last_name, email), Recruiting_Role(name, team)";

export const ApplicationRepository = {
    // One row per applicant per role, so writing an application is an upsert on
    // that constraint rather than an insert.
    upsertApplication: (application: Application) =>
        supabase
            .from("Recruiting_Application")
            .upsert(application, { onConflict: "user_id,role_id" })
            .select()
            .single(),

    // Callers build the update object field by field; this deliberately takes
    // whatever it is given, so nothing user-supplied should reach it unfiltered.
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

    // The applicant's own row for one role -- used to tell whether they have
    // already submitted.
    getApplicationForRole: (userId: string, roleId: string) =>
        supabase
            .from("Recruiting_Application")
            .select("*")
            .eq("user_id", userId)
            .eq("role_id", roleId)
            .maybeSingle(),

    // The admin viewer's list. Unlike the other methods this builds the query
    // up conditionally rather than returning one expression, because the
    // filters are all optional.
    listApplications: (filters: ApplicationListFilters) => {
        // !inner matters: with a plain embed, a filter on the embedded table
        // only blanks the embed out and the parent row still comes back. An
        // inner join is what actually drops non-matching applications.
        let query = supabase
            .from("Recruiting_Application")
            .select(
                "*, User!inner(first_name, last_name, email), Recruiting_Role!inner(name, team)"
            )
            .eq("cycle_id", filters.cycleId)
            .order("submitted_at", { ascending: false, nullsFirst: false });

        if (!filters.includeDrafts) {
            query = query.eq("is_submitted", true);
        }
        if (filters.status) {
            query = query.eq("status", filters.status);
        }
        if (filters.roleId) {
            query = query.eq("role_id", filters.roleId);
        }
        if (filters.team) {
            query = query.eq("Recruiting_Role.team", filters.team);
        }
        if (filters.search) {
            const term = sanitizeSearch(filters.search);
            if (term) {
                query = query.or(
                    `first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%`,
                    { referencedTable: "User" }
                );
            }
        }

        return query;
    },

    // An applicant may hold one application per role, so this is a list.
    getApplicationsByUser: (userId: string) =>
        supabase
            .from("Recruiting_Application")
            .select("*, Recruiting_Role(name, team)")
            .eq("user_id", userId)
            .order("created_at", { ascending: false }),
};
