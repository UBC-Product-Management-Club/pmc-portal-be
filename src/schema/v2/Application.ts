import { z } from "zod/v4";

// Validates the public submission body. `user_id`, `status`, and
// `submitted_at` are set by the server and must not be trusted from the client.
export const ApplicationSubmissionSchema = z.object({
    // jsonb NOT NULL in the DB — z.json() alone would accept `null`, so reject it here.
    application_data: z.json().refine((value) => value !== null, {
        message: "application_data is required",
    }),
});

export type ApplicationSubmission = z.infer<typeof ApplicationSubmissionSchema>;
