import { z } from "zod/v4";
import { Constants } from "./database.types";

const QuestionSchema = z.object({
    label: z.string(),
    questionType: z.enum(['short-answer', 'long-answer', 'dropdown', 'checkbox', 'radio', 'file']),
    options: z.array(z.string()).optional(),
    required: z.boolean().optional()
});

export const RecruitingFormSchema = z.object({
    title: z.string(),
    description: z.string().optional(),
    role: z.string().optional(),
    season: z.string().optional(),
    year: z.number().optional(),
    questions: z.array(QuestionSchema),
    status: z.enum(Constants.public.Enums.RECRUITING_FORM_STATUS).default("DRAFT"),
    opens_at: z.string().optional(),
    closes_at: z.string().optional(),
});

export type RecruitingFormInsert = z.infer<typeof RecruitingFormSchema>;
