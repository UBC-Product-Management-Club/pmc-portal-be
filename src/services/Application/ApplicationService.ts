import { Enums, Json, Tables } from "../../schema/v2/database.types";
import { ApplicationRepository } from "../../storage/ApplicationRepository";

type ExecApplication = Tables<"Exec_Application">;

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

export const submitApplication = async (
    userId: string,
    application: NewApplication
): Promise<ExecApplication> => {
    const { data, error } = await ApplicationRepository.addApplication({
        user_id: userId,
        position: application.position,
        application_data: application.application_data,
        choice_rank: application.choice_rank,
        resume_url: application.resume_url,
        status: "SUBMITTED",
    });
    if (error) {
        // The unique(user_id, position) constraint is the single source of truth
        // for duplicate submissions — map its violation to a friendly message.
        if (error.code === "23505") {
            throw new Error(
                `User ${userId} has already applied for ${application.position}`
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
    offset: number
): Promise<PaginatedApplications> => {
    const { data, error, count } = await ApplicationRepository.getApplications(
        limit,
        offset
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
