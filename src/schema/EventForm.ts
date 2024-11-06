import {z} from 'zod';

const QuestionSchema = z.object({
    id: z.string(),
    label: z.string(),
    questionType: z.enum(['list', 'text', 'checkbox', 'radio']), // Extend with other types if needed
    options: z.array(z.string()).optional(), // Used for types like 'list' or 'radio' where options are needed
    required: z.boolean().optional() // Optional, indicates if the question is mandatory
});

const EventFormSchema = z.object({
    title: z.string(),
    questions: z.array(QuestionSchema),
});

type EventForm = z.infer<typeof EventFormSchema>;