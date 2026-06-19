import { z } from "zod/v4";

// Validates the public submission body. `user_id`, `status`, and
// `submitted_at` are set by the server and must not be trusted from the client.
export const ApplicationSubmissionSchema = z.object({
    application_data: z.json(),
});

export type ApplicationSubmission = z.infer<typeof ApplicationSubmissionSchema>;
