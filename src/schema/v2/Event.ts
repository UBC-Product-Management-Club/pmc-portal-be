import { z } from "zod/v4";
import { Json } from "./database.types";

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
    thumbnail: z.string(), 
    needs_review: z.boolean()
});

export type EventInsert = z.infer<typeof EventSchema>;