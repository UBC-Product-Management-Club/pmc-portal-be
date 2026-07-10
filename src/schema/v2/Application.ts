import { z } from "zod/v4";

// Validates an applicant submission for a single exec position. Applicants apply
// once per position (see the unique(user_id, position) constraint). `user_id`,
// `status`, and `submitted_at` are set by the server and not trusted from the client.
//
// Column-vs-jsonb split: fields the dashboard filters or sorts on (position,
// choice_rank, resume_url) are dedicated columns; free-form question answers
// live in application_data keyed by question key (see config/recruitingQuestions).
export const ApplicationSubmissionSchema = z.object({
    position: z.string().min(1, { message: "position is required" }),
    // jsonb NOT NULL in the DB — z.json() alone would accept `null`, so reject it here.
    application_data: z.json().refine((value) => value !== null, {
        message: "application_data is required",
    }),
    // Where this position sits in the applicant's preferences ("First Choice", ...).
    // Promoted out of application_data so reviewers can sort by it.
    choice_rank: z.string().optional(),
    // Resume handling (PR #183 review): for now this is a URL string — the
    // frontend uploads the PDF to Supabase storage (see storage/Storage.ts
    // uploadSupabaseFiles) and submits the resulting link. A dedicated
    // multipart upload endpoint is a follow-up once the upload flow is decided.
    resume_url: z.string().optional(),
});

export type ApplicationSubmission = z.infer<typeof ApplicationSubmissionSchema>;

// Validates an admin/reviewer starring (or unstarring) an application to flag
// standout applicants ("people we want").
export const ApplicationStarSchema = z.object({
    is_starred: z.boolean(),
});

export type ApplicationStar = z.infer<typeof ApplicationStarSchema>;
