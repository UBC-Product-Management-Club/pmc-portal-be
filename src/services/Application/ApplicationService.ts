import { Enums, Json, Tables } from "../../schema/v2/database.types";
import { ApplicationRepository } from "../../storage/ApplicationRepository";
import { RecruitingCycleRepository } from "../../storage/RecruitingCycleRepository";

type ExecApplication = Tables<"Exec_Application">;
type RecruitingCycle = Tables<"Recruiting_Cycle">;

export interface NewApplication {
    position: string;
    application_data: Json;
    choice_rank?: string;
    resume_url?: string;
}

export interface PaginatedApplications {
    applications: ExecApplication[];
    total: number;
}

// The hiring cycle currently accepting applications, or null when none is open.
export const getActiveCycle = async (): Promise<RecruitingCycle | null> => {
    const { data, error } = await RecruitingCycleRepository.getActiveCycle();
    if (error) {
        throw new Error(
            `Failed to resolve the active recruiting cycle: ${error.message}`
        );
    }
    return data;
};

export const submitApplication = async (
    userId: string,
    application: NewApplication,
    cycleId: string
): Promise<ExecApplication> => {
    const { data, error } = await ApplicationRepository.addApplication({
        user_id: userId,
        cycle_id: cycleId,
        position: application.position,
        application_data: application.application_data,
        choice_rank: application.choice_rank,
        resume_url: application.resume_url,
        status: "SUBMITTED",
    });
    if (error) {
        // The unique(user_id, position, cycle_id) constraint is the single source
        // of truth for duplicates — one application per position per hiring cycle.
        if (error.code === "23505") {
            throw new Error(
                `User ${userId} has already applied for ${application.position} this cycle`
            );
        }
        throw new Error(`Failed to create application: ${error.message}`);
    }
    return data;
};

export const getApplicationsByUser = async (
    userId: string
): Promise<ExecApplication[]> => {
    const { data, error } = await ApplicationRepository.getApplicationsByUser(
        userId
    );
    if (error) {
        throw new Error(
            `Failed to get applications for user ${userId}: ${error.message}`
        );
    }
    return data ?? [];
};

export const listApplications = async (
    limit: number,
    offset: number,
    cycleId?: string
): Promise<PaginatedApplications> => {
    const { data, error, count } = await ApplicationRepository.getApplications(
        limit,
        offset,
        cycleId
    );
    if (error) {
        throw new Error(`Failed to list applications: ${error.message}`);
    }
    return { applications: data ?? [], total: count ?? 0 };
};

export const getApplication = async (
    applicationId: string
): Promise<ExecApplication | null> => {
    const { data, error } = await ApplicationRepository.getApplicationById(
        applicationId
    );
    if (error) {
        throw new Error(
            `Failed to get application ${applicationId}: ${error.message}`
        );
    }
    return data;
};

// Fetch an application for reviewing, marking it UNDER_REVIEW the first time an
// exec opens it (SUBMITTED -> UNDER_REVIEW; later statuses are never reverted).
// Returns null when no application matches the id (caller should 404).
export const viewApplication = async (
    applicationId: string
): Promise<ExecApplication | null> => {
    const application = await getApplication(applicationId);
    if (!application || application.status !== "SUBMITTED") {
        return application;
    }

    const { error } = await ApplicationRepository.updateStatus(
        applicationId,
        "UNDER_REVIEW"
    );
    if (error) {
        throw new Error(
            `Failed to mark application ${applicationId} under review: ${error.message}`
        );
    }
    return { ...application, status: "UNDER_REVIEW" };
};

// Star/unstar an application to flag standout applicants. Returns null when no
// application matches the id (caller should 404).
export const setApplicationStar = async (
    applicationId: string,
    isStarred: boolean
): Promise<ExecApplication | null> => {
    const { data, error } = await ApplicationRepository.setStarred(
        applicationId,
        isStarred
    );
    if (error) {
        throw new Error(
            `Failed to update star on application ${applicationId}: ${error.message}`
        );
    }
    return data;
};

// Explicitly set an applicant's status (accept/reject/etc). Returns null when
// no application matches the id (caller should 404).
export const updateApplicationStatus = async (
    applicationId: string,
    status: Enums<"APPLICATION_STATUS">
): Promise<ExecApplication | null> => {
    const { data, error } = await ApplicationRepository.updateStatus(
        applicationId,
        status
    );
    if (error) {
        throw new Error(
            `Failed to update application ${applicationId} status: ${error.message}`
        );
    }
    return data;
};
