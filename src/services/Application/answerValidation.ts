import { Json } from "../../schema/v2/database.types";
import { FormQuestion } from "../../schema/v2/Application";

export interface AnswerError {
    key: string;
    message: string;
}

const countWords = (value: string): number =>
    value.trim().split(/\s+/).filter(Boolean).length;

const isBlank = (value: Json | undefined): boolean =>
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "") ||
    (Array.isArray(value) && value.length === 0);

// Validates one answer against its question. Assumes the answer is present.
const validateAnswer = (
    question: FormQuestion,
    value: Json
): string | null => {
    const { type, options, max_words, label } = question;

    if (type === "MULTI_SELECT") {
        if (!Array.isArray(value)) {
            return `${label} must be a list of selections`;
        }
        const invalid = value.filter(
            (entry) => typeof entry !== "string" || !options?.includes(entry)
        );
        if (invalid.length > 0) {
            return `${label} contains invalid selections: ${invalid.join(", ")}`;
        }
        return null;
    }

    // Every remaining type is stored as a plain string.
    if (typeof value !== "string") {
        return `${label} must be text`;
    }

    if (type === "SELECT" && !options?.includes(value)) {
        return `${label} must be one of: ${(options ?? []).join(", ")}`;
    }

    if (type === "URL") {
        try {
            new URL(value);
        } catch {
            return `${label} must be a valid URL`;
        }
    }

    if (max_words != null && countWords(value) > max_words) {
        return `${label} must be at most ${max_words} words`;
    }

    return null;
};

// Checks a submitted answer set against the form's questions. Returns every
// problem found (rather than failing on the first) so the applicant can fix
// their whole form in one pass. An empty array means the answers are valid.
export const validateAnswers = (
    questions: FormQuestion[],
    answers: Record<string, Json>
): AnswerError[] => {
    const errors: AnswerError[] = [];

    for (const question of questions) {
        const value = answers[question.key];

        if (isBlank(value)) {
            if (question.required) {
                errors.push({
                    key: question.key,
                    message: `${question.label} is required`,
                });
            }
            // Blank optional answers are fine and skip the type checks below.
            continue;
        }

        const message = validateAnswer(question, value);
        if (message) {
            errors.push({ key: question.key, message });
        }
    }

    // Reject anything not on the form so stray/renamed keys surface loudly
    // rather than silently persisting into the answers jsonb.
    const known = new Set(questions.map((question) => question.key));
    for (const key of Object.keys(answers)) {
        if (!known.has(key)) {
            errors.push({ key, message: `${key} is not a question on this form` });
        }
    }

    return errors;
};
