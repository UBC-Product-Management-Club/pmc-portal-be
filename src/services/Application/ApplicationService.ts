import { Enums, Json, Tables } from "../../schema/v2/database.types";
import {
    ApplicationSubmission,
    FormQuestion,
} from "../../schema/v2/Application";
import { ApplicationRepository } from "../../storage/ApplicationRepository";
import { RecruitingRepository } from "../../storage/RecruitingRepository";
import { AnswerError, validateAnswers } from "./answerValidation";

type Application = Tables<"Recruiting_Application">;
type RecruitingCycle = Tables<"Recruiting_Cycle">;

export interface OpenRole {
    role_id: string;
    name: string;
    team: Enums<"RECRUITING_TEAM">;
}

export interface ApplicationForm {
    role_id: string;
    role_name: string;
    team: Enums<"RECRUITING_TEAM">;
    // General questions first, then the role's own -- already ordered.
    questions: FormQuestion[];
}

// Raised when submitted answers fail the form's own rules; the route turns
// this into a 400 listing every offending field.
export class AnswerValidationError extends Error {
    constructor(public readonly errors: AnswerError[]) {
        super("Submitted answers are invalid");
        this.name = "AnswerValidationError";
    }
}

// Raised when there is no open cycle, or the role belongs to a different one.
// The route turns this into a 403.
export class ApplicationsClosedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ApplicationsClosedError";
    }
}

// Raised when an applicant tries to change an application they already
// submitted. The route turns this into a 409.
export class AlreadySubmittedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "AlreadySubmittedError";
    }
}

// Questions are stored as jsonb, so they arrive as `Json` and need narrowing
// before use. Anything that isn't an array is treated as "no questions".
const toQuestions = (value: Json | null | undefined): FormQuestion[] =>
    Array.isArray(value) ? (value as unknown as FormQuestion[]) : [];

const byDisplayOrder = (questions: FormQuestion[]): FormQuestion[] =>
    [...questions].sort(
        (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)
    );

// The hiring cycle currently accepting applications, or null when closed.
export const getActiveCycle = async (): Promise<RecruitingCycle | null> => {
    const { data, error } = await RecruitingRepository.getActiveCycle();
    if (error) {
        throw new Error(
            `Failed to resolve the active recruiting cycle: ${error.message}`
        );
    }
    return data;
};

// Roles open for applications within a cycle. Takes the cycle id so a caller
// that already resolved the active cycle doesn't re-query for it.
export const getRolesForCycle = async (
    cycleId: string
): Promise<OpenRole[]> => {
    const { data, error } = await RecruitingRepository.getRolesForCycle(cycleId);
    if (error) {
        throw new Error(`Failed to list open roles: ${error.message}`);
    }

    return (data ?? []).map((role) => ({
        role_id: role.role_id,
        name: role.name,
        team: role.team,
    }));
};

export const getOpenRoles = async (): Promise<OpenRole[]> => {
    const cycle = await getActiveCycle();
    return cycle ? getRolesForCycle(cycle.cycle_id) : [];
};

// Loads a role and checks it belongs to the currently open cycle. Everything
// that acts on a role goes through here so a stale role id from a previous
// cycle can never be used.
const getRoleInActiveCycle = async (roleId: string) => {
    const cycle = await getActiveCycle();
    if (!cycle) {
        throw new ApplicationsClosedError("Applications are currently closed");
    }

    const { data: role, error } = await RecruitingRepository.getRole(roleId);
    if (error) {
        throw new Error(`Failed to load role ${roleId}: ${error.message}`);
    }
    if (!role || role.cycle_id !== cycle.cycle_id) {
        throw new ApplicationsClosedError(
            "This role is not part of the current hiring cycle"
        );
    }

    return { cycle, role };
};

// The full question set for one role: the cycle's shared general questions
// followed by that role's own. Returns null for a role outside the open cycle.
export const getApplicationForm = async (
    roleId: string
): Promise<ApplicationForm | null> => {
    let cycle, role;
    try {
        ({ cycle, role } = await getRoleInActiveCycle(roleId));
    } catch (error) {
        // A closed cycle or a role from a previous one is a 404 here rather
        // than an error: there is simply no form to render.
        if (error instanceof ApplicationsClosedError) {
            return null;
        }
        throw error;
    }

    return {
        role_id: role.role_id,
        role_name: role.name,
        team: role.team,
        questions: [
            ...byDisplayOrder(toQuestions(cycle.general_questions)),
            ...byDisplayOrder(toQuestions(role.questions)),
        ],
    };
};

export const getApplicationsByUser = async (
    userId: string
): Promise<Application[]> => {
    const { data, error } = await ApplicationRepository.getApplicationsByUser(
        userId
    );
    if (error) {
        throw new Error(
            `Failed to get applications for user ${userId}: ${error.message}`
        );
    }
    return (data ?? []) as unknown as Application[];
};

// The applicant's existing row for a role, or null if they haven't started.
export const getApplicationForRole = async (
    userId: string,
    roleId: string
): Promise<Application | null> => {
    const { data, error } = await ApplicationRepository.getApplicationForRole(
        userId,
        roleId
    );
    if (error) {
        throw new Error(
            `Failed to load application for role ${roleId}: ${error.message}`
        );
    }
    return data;
};

// Guards against editing something already submitted.
const assertNotAlreadySubmitted = async (
    userId: string,
    roleId: string
) => {
    const existing = await getApplicationForRole(userId, roleId);
    if (existing?.is_submitted) {
        throw new AlreadySubmittedError(
            "You have already submitted an application for this role"
        );
    }
    return existing;
};

// Commits an application. Validates the answers against the form first, then
// writes the row as submitted.
export const submitApplication = async (
    userId: string,
    submission: ApplicationSubmission
): Promise<{ application: Application; role_name: string }> => {
    const { cycle, role } = await getRoleInActiveCycle(submission.role_id);
    await assertNotAlreadySubmitted(userId, submission.role_id);

    const questions = [
        ...toQuestions(cycle.general_questions),
        ...toQuestions(role.questions),
    ];
    const errors = validateAnswers(questions, submission.answers);
    if (errors.length > 0) {
        throw new AnswerValidationError(errors);
    }

    const now = new Date().toISOString();
    const { data, error } = await ApplicationRepository.upsertApplication({
        user_id: userId,
        cycle_id: cycle.cycle_id,
        role_id: role.role_id,
        answers: submission.answers,
        choice_rank: submission.choice_rank,
        resume_url: submission.resume_url ?? null,
        referred_by: submission.referred_by ?? null,
        is_submitted: true,
        status: "SUBMITTED",
        submitted_at: now,
        updated_at: now,
    });
    if (error) {
        throw new Error(`Failed to submit application: ${error.message}`);
    }

    return { application: data, role_name: role.name };
};
