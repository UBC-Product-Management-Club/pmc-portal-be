import { z } from "zod/v4";
import { Constants } from "./database.types";

// Question types are no longer a Postgres enum -- questions live in jsonb on
// the cycle and role rows, so this schema is the single source of truth for
// their shape.
export const QUESTION_TYPES = [
    "SHORT_TEXT",
    "LONG_TEXT",
    "SELECT",
    "MULTI_SELECT",
    "FILE",
    "URL",
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

// One question on a form. `key` is what answers are keyed by, so it must be
// stable -- renaming a label is safe, renaming a key orphans existing answers.
export const QuestionSchema = z
    .strictObject({
        key: z.string().min(1, { message: "Question key can't be empty" }),
        label: z.string().min(1, { message: "Question label can't be empty" }),
        type: z.enum(QUESTION_TYPES),
        options: z.array(z.string()).nullable().optional(),
        required: z.boolean().default(true),
        max_words: z.number().int().positive().nullable().optional(),
        display_order: z.number().int(),
    })
    .refine(
        (question) =>
            !["SELECT", "MULTI_SELECT"].includes(question.type) ||
            (question.options?.length ?? 0) > 0,
        {
            message: "SELECT and MULTI_SELECT questions need at least one option",
            path: ["options"],
        }
    );

export const QuestionListSchema = z.array(QuestionSchema);

export type Question = z.infer<typeof QuestionSchema>;

// A question as it comes back out of the cycle's `general_questions` or a
// role's `questions` jsonb. Structural rather than the inferred zod type, so
// consumers can stay plain functions over plain data.
export interface FormQuestion {
    key: string;
    label: string;
    type: QuestionType;
    options?: string[] | null;
    required: boolean;
    max_words?: number | null;
    // Only used when a form is assembled; irrelevant once answers are checked.
    display_order?: number;
}

// Answers are keyed by question key. Values stay loose here; they are checked
// against the form's own questions in services/Application/answerValidation.
const answersSchema = z.record(z.string(), z.json());

// Saving a draft: everything except the role is optional, because a draft is by
// definition incomplete. Required-answer rules are deliberately NOT applied.
export const ApplicationDraftSchema = z.strictObject({
    role_id: z.string().min(1, { message: "role_id is required" }),
    answers: answersSchema.optional(),
    choice_rank: z.enum(Constants.public.Enums.APPLICATION_CHOICE_RANK).optional(),
    resume_url: z.string().optional(),
    referred_by: z.string().optional(),
});

// Submitting: the applicant commits, so choice_rank and answers are required
// and the answers get validated against the form.
export const ApplicationSubmitSchema = z.strictObject({
    role_id: z.string().min(1, { message: "role_id is required" }),
    answers: answersSchema,
    choice_rank: z.enum(Constants.public.Enums.APPLICATION_CHOICE_RANK),
    resume_url: z.string().optional(),
    referred_by: z.string().optional(),
});

export type ApplicationDraft = z.infer<typeof ApplicationDraftSchema>;
export type ApplicationSubmission = z.infer<typeof ApplicationSubmitSchema>;

// --- Admin viewer -----------------------------------------------------------

// Filters for the applicant viewer's list. strictObject so a mistyped parameter
// fails loudly instead of being silently ignored and returning everything.
export const ApplicationListQuerySchema = z.strictObject({
    status: z.enum(Constants.public.Enums.APPLICATION_STATUS).optional(),
    role_id: z.string().min(1).optional(),
    team: z.enum(Constants.public.Enums.RECRUITING_TEAM).optional(),
    search: z.string().trim().min(1).max(100).optional(),
    // Query strings carry no booleans, so this arrives as text.
    include_drafts: z.enum(["true", "false"]).optional(),
});

// DRAFT is the applicant's own state and is tied to is_submitted by a check
// constraint, so it is never something an exec sets from the viewer.
const SETTABLE_STATUSES = Constants.public.Enums.APPLICATION_STATUS.filter(
    (status) => status !== "DRAFT"
) as Exclude<(typeof Constants.public.Enums.APPLICATION_STATUS)[number], "DRAFT">[];

export const ApplicationStatusUpdateSchema = z.strictObject({
    status: z.enum(SETTABLE_STATUSES as [(typeof SETTABLE_STATUSES)[number], ...typeof SETTABLE_STATUSES]),
});

// Both fields are nullable so a note can be cleared, and both are optional so a
// caller can update one without resending the other -- but sending neither is a
// no-op worth rejecting.
export const ApplicationNotesUpdateSchema = z
    .strictObject({
        referral_notes: z.string().max(5000).nullable().optional(),
        general_notes: z.string().max(5000).nullable().optional(),
    })
    .refine(
        (notes) =>
            notes.referral_notes !== undefined || notes.general_notes !== undefined,
        { message: "Provide referral_notes, general_notes, or both" }
    );

export type ApplicationListQuery = z.infer<typeof ApplicationListQuerySchema>;
export type ApplicationStatusUpdate = z.infer<typeof ApplicationStatusUpdateSchema>;
export type ApplicationNotesUpdate = z.infer<typeof ApplicationNotesUpdateSchema>;
