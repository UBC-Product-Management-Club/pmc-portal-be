import {z} from 'zod';

const QuestionSchema = z.object({
    label: z.string(),
    questionType: z.enum(['short-answer', 'long-answer', 'dropdown', 'checkbox', 'radio', 'file']), // Extend with other types if needed
    options: z.array(z.string()).optional(), // Used for types like 'list' or 'radio' where options are needed
    required: z.boolean().optional() // Optional, indicates if the question is mandatory
});

export const EventFormSchema = z.object({
    title: z.string(),
    questions: z.array(QuestionSchema),
});

export type EventForm = z.infer<typeof EventFormSchema>;
