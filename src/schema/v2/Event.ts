import { z } from "zod/v4";

const numericField = (label: string) =>
    z
        .string(`${label} is required`)
        .trim()
        .min(1, `${label} is required`)
        .refine((value) => Number.isFinite(Number(value)), `${label} must be a number`)
        .transform(Number);

const jsonField = (label: string) =>
    z
        .string()
        .optional()
        .transform((value, ctx) => {
            if (value === undefined || value.trim() === "") return [];
            try {
                return JSON.parse(value);
            } catch {
                ctx.addIssue({ code: "custom", message: `${label} must be valid JSON` });
                return z.NEVER;
            }
        });

export const EventCreateSchema = z
    .object({
        name: z.string("Name is required").trim().min(1, "Name can't be empty"),
        blurb: z.string().default(""),
        description: z.string().default(""),
        location: z.string("Location is required").trim().min(1, "Location can't be empty"),
        max_attendees: numericField("Max attendees").pipe(
            z
                .number()
                .int("Max attendees must be a whole number")
                .positive("Max attendees must be positive")
        ),
        member_price: numericField("Member price").pipe(
            z.number().nonnegative("Member price can't be negative")
        ),
        non_member_price: numericField("Non-member price").pipe(
            z.number().nonnegative("Non-member price can't be negative")
        ),
        start_time: z.iso.datetime({ offset: true, message: "Start time must be a valid date/time" }),
        end_time: z.iso.datetime({ offset: true, message: "End time must be a valid date/time" }),
        registration_opens: z.iso.datetime({
            offset: true,
            message: "Registration opens must be a valid date/time",
        }),
        registration_closes: z.iso.datetime({
            offset: true,
            message: "Registration closes must be a valid date/time",
        }),
        // Not in the admin form yet — these default until the create UI grows them.
        needs_review: z.stringbool().default(false),
        event_form_questions: jsonField("Event form questions"),
    })
    .refine((fields) => new Date(fields.end_time) >= new Date(fields.start_time), {
        message: "end_time must not be before start_time",
        path: ["end_time"],
    })
    .refine(
        (fields) => new Date(fields.registration_closes) >= new Date(fields.registration_opens),
        {
            message: "registration_closes must not be before registration_opens",
            path: ["registration_closes"],
        }
    );

export type EventCreate = z.infer<typeof EventCreateSchema>;

export type EventInsert = EventCreate & {
    event_id: string;
    date: string;
    media: string[];
    thumbnail: string | null;
    is_disabled: boolean;
};

export const EventUpdateSchema = z
    .strictObject({
        name: z.string().min(1, "Name can't be empty").optional(),
        blurb: z.string().optional(),
        description: z.string().optional(),
        location: z.string().min(1, "Location can't be empty").optional(),
        max_attendees: z.number("Max attendees must be a number").int("Max attendees must be a whole number").positive("Max attendees must be positive").optional(),
        member_price: z.number("Member price must be a number").nonnegative("Member price can't be negative").optional(),
        non_member_price: z.number("Non-member price must be a number").nonnegative("Non-member price can't be negative").optional(),
        start_time: z.iso.datetime({ offset: true }).optional(),
        end_time: z.iso.datetime({ offset: true }).optional(),
        registration_opens: z.iso.datetime({ offset: true }).optional(),
        registration_closes: z.iso.datetime({ offset: true }).optional(),
    })
    .refine((fields) => Object.keys(fields).length > 0, {
        message: "At least one field is required",
    })
    .refine((fields) => (fields.start_time === undefined) === (fields.end_time === undefined), {
        message: "start_time and end_time must be provided together",
        path: ["end_time"],
    })
    .refine(
        (fields) =>
            !fields.start_time ||
            !fields.end_time ||
            new Date(fields.end_time) >= new Date(fields.start_time),
        {
            message: "end_time must not be before start_time",
            path: ["end_time"],
        }
    )
    .refine(
        (fields) =>
            (fields.registration_opens === undefined) ===
            (fields.registration_closes === undefined),
        {
            message: "registration_opens and registration_closes must be provided together",
            path: ["registration_closes"],
        }
    )
    .refine(
        (fields) =>
            !fields.registration_opens ||
            !fields.registration_closes ||
            new Date(fields.registration_closes) >= new Date(fields.registration_opens),
        {
            message: "registration_closes must not be before registration_opens",
            path: ["registration_closes"],
        }
    );

export type EventUpdate = z.infer<typeof EventUpdateSchema>;