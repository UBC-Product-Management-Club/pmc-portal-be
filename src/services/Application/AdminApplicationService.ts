import { Enums, Tables } from "../../schema/v2/database.types";
import {
    ApplicationListQuery,
    ApplicationNotesUpdate,
} from "../../schema/v2/Application";
import {
    ApplicationListFilters,
    ApplicationRepository,
} from "../../storage/ApplicationRepository";
import { RecruitingRepository } from "../../storage/RecruitingRepository";
import { createSignedUrl } from "../../storage/SignedUrl";

type Application = Tables<"Recruiting_Application">;
type RecruitingCycle = Tables<"Recruiting_Cycle">;
type AdminRole = Enums<"ADMIN_ROLE">;

// Raised when the application id doesn't exist. The route turns this into a 404.
export class ApplicationNotFoundError extends Error {
    constructor(applicationId: string) {
        super(`No application found with id ${applicationId}`);
        this.name = "ApplicationNotFoundError";
    }
}

// Raised when an allowlisted exec is in the portal but lacks the role for this
// particular action. The route turns this into a 403.
export class ForbiddenError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ForbiddenError";
    }
}

// Raised when a status change would break the is_submitted/status invariant.
// The route turns this into a 409.
export class InvalidStatusTransitionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "InvalidStatusTransitionError";
    }
}

const canEditGeneralNotes = (role: AdminRole) =>
    role === "VP" || role === "PRESIDENT";

export interface AdminRoleOption {
    role_id: string;
    name: string;
    team: Enums<"RECRUITING_TEAM">;
    is_active: boolean;
}

// The cycle the viewer works against, plus every role on it. Unlike the
// applicant-facing equivalent this does not require the cycle to be active --
// execs review applications after a cycle closes, and set roles up before it
// opens.
export const getAdminCycle = async (): Promise<{
    cycle: RecruitingCycle | null;
    roles: AdminRoleOption[];
}> => {
    const { data: cycle, error } = await RecruitingRepository.getLatestCycle();
    if (error) {
        throw new Error(`Failed to load the recruiting cycle: ${error.message}`);
    }
    if (!cycle) {
        return { cycle: null, roles: [] };
    }

    const { data: roles, error: rolesError } =
        await RecruitingRepository.getAllRolesForCycle(cycle.cycle_id);
    if (rolesError) {
        throw new Error(`Failed to load roles: ${rolesError.message}`);
    }

    return {
        cycle,
        roles: (roles ?? []).map((role) => ({
            role_id: role.role_id,
            name: role.name,
            team: role.team,
            is_active: role.is_active,
        })),
    };
};

// Every application on the current cycle, narrowed by the viewer's filters.
export const listApplications = async (
    query: ApplicationListQuery
): Promise<{ cycle: RecruitingCycle | null; applications: Application[] }> => {
    const { data: cycle, error } = await RecruitingRepository.getLatestCycle();
    if (error) {
        throw new Error(`Failed to load the recruiting cycle: ${error.message}`);
    }
    if (!cycle) {
        return { cycle: null, applications: [] };
    }

    const filters: ApplicationListFilters = {
        cycleId: cycle.cycle_id,
        status: query.status,
        roleId: query.role_id,
        team: query.team,
        search: query.search,
        includeDrafts: query.include_drafts === "true",
    };

    const { data, error: listError } = await ApplicationRepository.listApplications(
        filters
    );
    if (listError) {
        throw new Error(`Failed to list applications: ${listError.message}`);
    }

    return { cycle, applications: (data ?? []) as unknown as Application[] };
};

// One application in full. Opening it is what marks it as reviewed, so a
// SUBMITTED row moves to REVIEWED here and nowhere else.
export const getApplicationDetail = async (
    applicationId: string
): Promise<Application & { resume_signed_url?: string }> => {
    const { data, error } = await ApplicationRepository.getApplication(
        applicationId
    );
    if (error) {
        throw new Error(
            `Failed to load application ${applicationId}: ${error.message}`
        );
    }
    if (!data) {
        throw new ApplicationNotFoundError(applicationId);
    }

    let application = data as unknown as Application;

    // Only the first viewing moves it along; anything further down the pipeline
    // is left where it is.
    if (application.status === "SUBMITTED") {
        const { data: reviewed, error: reviewError } =
            await ApplicationRepository.updateApplication(applicationId, {
                status: "REVIEWED",
                // No trigger maintains this column, so every write sets it.
                updated_at: new Date().toISOString(),
            });
        if (reviewError) {
            throw new Error(
                `Failed to mark application ${applicationId} as reviewed: ${reviewError.message}`
            );
        }
        if (reviewed) {
            // The update returns the bare row, so keep the applicant and role
            // joins from the original read.
            application = { ...application, ...reviewed };
        }
    }

    // resume_url holds a private storage path, not a link.
    if (application.resume_url) {
        const bucket = process.env.SUPABASE_RECRUITING_BUCKET;
        if (bucket) {
            return {
                ...application,
                resume_signed_url: await createSignedUrl(
                    bucket,
                    application.resume_url
                ),
            };
        }
    }

    return application;
};

// Referral notes are collaborative -- any exec can leave one. General notes are
// the evaluators' own, so they follow the same rule as status changes.
export const updateNotes = async (
    applicationId: string,
    actorRole: AdminRole,
    notes: ApplicationNotesUpdate
): Promise<Application> => {
    if (notes.general_notes !== undefined && !canEditGeneralNotes(actorRole)) {
        throw new ForbiddenError("Only VPs can edit general notes");
    }

    // Built field by field rather than spread from the request, so a caller can
    // never reach the answers, status or ownership columns through this route.
    const updates: {
        referral_notes?: string | null;
        general_notes?: string | null;
        updated_at: string;
    } = { updated_at: new Date().toISOString() };

    if (notes.referral_notes !== undefined) {
        updates.referral_notes = notes.referral_notes;
    }
    if (notes.general_notes !== undefined) {
        updates.general_notes = notes.general_notes;
    }

    const { data, error } = await ApplicationRepository.updateApplication(
        applicationId,
        updates
    );
    if (error) {
        throw new Error(
            `Failed to update notes on application ${applicationId}: ${error.message}`
        );
    }
    if (!data) {
        throw new ApplicationNotFoundError(applicationId);
    }
    return data;
};

// Moves an application along the hiring pipeline. The route's requireVP decides
// who may call this; what's enforced here is that the row is in a state where a
// status change is meaningful.
export const updateStatus = async (
    applicationId: string,
    status: Exclude<Enums<"APPLICATION_STATUS">, "DRAFT">
): Promise<Application> => {
    const { data: existing, error } = await ApplicationRepository.getApplication(
        applicationId
    );
    if (error) {
        throw new Error(
            `Failed to load application ${applicationId}: ${error.message}`
        );
    }
    if (!existing) {
        throw new ApplicationNotFoundError(applicationId);
    }

    // A check constraint ties status to is_submitted, so this would be rejected
    // by the database anyway -- catching it here turns an opaque 500 into a
    // clear 409.
    if (!existing.is_submitted) {
        throw new InvalidStatusTransitionError(
            "Cannot change the status of a draft application"
        );
    }

    const { data, error: updateError } =
        await ApplicationRepository.updateApplication(applicationId, {
            status,
            updated_at: new Date().toISOString(),
        });
    if (updateError) {
        throw new Error(
            `Failed to update status on application ${applicationId}: ${updateError.message}`
        );
    }
    if (!data) {
        throw new ApplicationNotFoundError(applicationId);
    }
    return data;
};
