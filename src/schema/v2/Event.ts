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
    needs_review: z.boolean()
});

export type EventInsert = z.infer<typeof EventSchema>;

export const EventUpdateSchema = z
    .strictObject({
        name: z.string().min(1).optional(),
        blurb: z.string().optional(),
        description: z.string().optional(),
        location: z.string().min(1).optional(),
        max_attendees: z.number().int().positive().optional(),
    })
    .refine((fields) => Object.keys(fields).length > 0, {
        message: "At least one field is required",
    });

export type EventUpdate = z.infer<typeof EventUpdateSchema>;