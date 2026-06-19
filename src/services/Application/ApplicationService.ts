import { Json, Tables } from "../../schema/v2/database.types";
import { ApplicationRepository } from "../../storage/ApplicationRepository";

export const submitApplication = async (
    userId: string,
    applicationData: Json
): Promise<Tables<"Application">> => {
    const { data: existing, error: existingError } =
        await ApplicationRepository.getApplicationByUser(userId);
    if (existingError) {
        throw new Error(
            `Failed to check existing application for user ${userId}: ${existingError.message}`
        );
    }
    if (existing) {
        throw new Error(`User ${userId} has already submitted an application`);
    }

    const { data, error } = await ApplicationRepository.addApplication({
        user_id: userId,
        application_data: applicationData,
        status: "SUBMITTED",
    });
    if (error) {
        throw new Error(`Failed to create application: ${error.message}`);
    }
    return data;
};

export const getApplicationByUser = async (
    userId: string
): Promise<Tables<"Application"> | null> => {
    const { data, error } = await ApplicationRepository.getApplicationByUser(
        userId
    );
    if (error) {
        throw new Error(
            `Failed to get application for user ${userId}: ${error.message}`
        );
    }
    return data;
};

export const listApplications = async (): Promise<Tables<"Application">[]> => {
    const { data, error } = await ApplicationRepository.getApplications();
    if (error) {
        throw new Error(`Failed to list applications: ${error.message}`);
    }
    return data ?? [];
};

export const getApplication = async (
    applicationId: string
): Promise<Tables<"Application"> | null> => {
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
