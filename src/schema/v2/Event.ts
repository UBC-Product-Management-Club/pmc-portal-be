import { z } from "zod/v4";

export const EventSchema = z.object({
    event_id: z.string(),
    name: z.string(),
    date: z.string(),
    start_time: z.string(),
    end_time: z.string(),
    description: z.string(),
    location: z.string(),
    member_price: z.string().transform(Number),
    non_member_price: z.string().transform(Number),
    max_attendees: z.string().transform(Number),
    event_form_questions: z.json(),
    is_disabled: z.boolean().default(false),
    media: z.array(z.string()),
    needs_review: z.boolean(),
    thumbnail: z.string().nullable().optional(),
});

export type EventInsert = z.infer<typeof EventSchema>;

export const EventUpdateSchema = z
    .strictObject({
        name: z.string().min(1, "Name can't be empty").optional(),
        blurb: z.string().optional(),
        description: z.string().optional(),
        location: z.string().min(1, "Location can't be empty").optional(),
        max_attendees: z.number("Max attendees must be a number").int("Max attendees must be a whole number").positive("Max attendees must be positive").optional(),
        start_time: z.iso.datetime({ offset: true }).optional(),
        end_time: z.iso.datetime({ offset: true }).optional(),
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
    );

export type EventUpdate = z.infer<typeof EventUpdateSchema>;