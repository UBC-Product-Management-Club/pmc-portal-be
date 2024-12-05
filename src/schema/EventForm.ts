import {z} from 'zod';

const QuestionSchema = z.object({
    label: z.string(),
    questionType: z.enum(['short-answer', 'long-answer', 'dropdown', 'checkbox', 'radio', 'file']),
    options: z.array(z.string()).optional(),
    required: z.boolean().optional()
});

export const EventFormSchema = z.object({
    title: z.string(),
    questions: z.array(QuestionSchema),
});

export type EventForm = z.infer<typeof EventFormSchema>;
