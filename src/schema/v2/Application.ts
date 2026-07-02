import { z } from "zod/v4";
import { Constants } from "./database.types";

// Validates the public submission body. `user_id`, `status`, and
// `submitted_at` are set by the server and must not be trusted from the client.
export const ApplicationSubmissionSchema = z.object({
    // jsonb NOT NULL in the DB — z.json() alone would accept `null`, so reject it here.
    application_data: z.json().refine((value) => value !== null, {
        message: "application_data is required",
    }),
});

export type ApplicationSubmission = z.infer<typeof ApplicationSubmissionSchema>;

// Validates an admin/reviewer status update. Enum values are sourced from the
// generated DB constants so invalid statuses are rejected without duplicating them.
export const ApplicationStatusUpdateSchema = z.object({
    status: z.enum(Constants.public.Enums.APPLICATION_STATUS),
});

export type ApplicationStatusUpdate = z.infer<
    typeof ApplicationStatusUpdateSchema
>;
