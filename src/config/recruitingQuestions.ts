// Recruiting application questions, split into a base set (asked of every
// applicant) and role-specific sets. Seeded from the Spring '26 Exec Hiring form.
//
// This is intentionally a config file for now so the frontend can render forms
// immediately. When #174 (recruiting form schema) lands, these definitions move
// into the DB so execs can edit them from the admin portal — same shape.

export type QuestionType =
    | "short_text"
    | "long_text"
    | "select"
    | "multi_select";

export interface Question {
    key: string;
    label: string;
    type: QuestionType;
    required: boolean;
    maxWords?: number;
    options?: string[];
}

// The exec positions applicants can apply for (one application per position).
export const POSITIONS = [
    "VP Events",
    "Events Director",
    "VP Community",
    "Community Director",
    "Design Director",
    "Marketing Director",
    "Media Director",
    "Finance Director",
    "Product Designer",
    "Developer",
    "Corporate Outreach Director",
    "Mentor Outreach Director",
    "Program Director",
    "Program Outreach Director",
] as const;

export type Position = (typeof POSITIONS)[number];

// Asked of every applicant regardless of position.
export const BASE_QUESTIONS: Question[] = [
    { key: "first_name", label: "First Name", type: "short_text", required: true },
    { key: "last_name", label: "Last Name", type: "short_text", required: true },
    { key: "student_number", label: "Student Number", type: "short_text", required: true },
    { key: "email", label: "Email", type: "short_text", required: true },
    {
        key: "how_found",
        label: "How did you find out about this opportunity?",
        type: "multi_select",
        required: true,
        options: [
            "Instagram",
            "PMC Booth",
            "LinkedIn",
            "Word of Mouth",
            "Previous PMC Events",
            "PMC Newsletter",
            "Other",
        ],
    },
    {
        key: "year",
        label: "What year will you be going into in Fall 2026?",
        type: "select",
        required: true,
        options: ["Year 1", "Year 2", "Year 3", "Year 4", "Year 5+"],
    },
    {
        key: "faculty",
        label: "Faculty",
        type: "select",
        required: true,
        options: [
            "Architecture",
            "Arts",
            "Applied Science",
            "Sauder School of Business",
            "Science",
            "Land and Food Systems",
            "Forestry",
        ],
    },
    { key: "major", label: "Major", type: "short_text", required: true },
    {
        key: "why_exec",
        label: "Why do you want to be an Exec at UBC PMC? What's in it for you?",
        type: "long_text",
        required: true,
        maxWords: 150,
    },
    {
        key: "why_pm",
        label: "What makes you interested in Product Management, or the product space in general?",
        type: "long_text",
        required: true,
        maxWords: 150,
    },
    {
        key: "choice_rank",
        label: "Is this your first-choice, second-choice, third+ choice, or the only position you're applying for?",
        type: "select",
        required: true,
        options: [
            "First Choice",
            "Second Choice",
            "Third+ Choice",
            "Only Position I am Applying for",
        ],
    },
    {
        key: "commitments",
        label: "Please elaborate on your commitments for Summer 2026, Fall 2026 and Winter 2026.",
        type: "long_text",
        required: true,
    },
    { key: "linkedin", label: "Share your LinkedIn with us, if you would like!", type: "short_text", required: false },
    { key: "anything_else", label: "Is there anything you would like us to know?", type: "long_text", required: false },
];

// Role-specific questions layered on top of the base set. Only Developer is
// filled in from the real form so far — the rest are placeholders to fill in
// once the per-role questions are confirmed (prez meeting / #174).
export const ROLE_QUESTIONS: Partial<Record<Position, Question[]>> = {
    Developer: [
        {
            key: "technical_project",
            label: "Tell us about a technical project where you chose a new technology — the goal, why that tech, and the biggest hurdles.",
            type: "long_text",
            required: true,
            maxWords: 150,
        },
        {
            key: "tech_to_learn",
            label: "Is there a specific technology you're eager to learn more about? What excites you about it?",
            type: "long_text",
            required: true,
            maxWords: 150,
        },
        { key: "cpsc_courses", label: "Share some of the CPSC courses (or equivalent) you've taken at UBC.", type: "short_text", required: false },
        { key: "if_language", label: "If you could be a coding language, which one would it be and why?", type: "long_text", required: false },
        { key: "portfolio_link", label: "Link to your work (Portfolio, Website, GitHub, etc.)", type: "short_text", required: true },
    ],
};

// Returns the full question set for a position: base questions plus any
// role-specific ones. Unknown positions just get the base set.
export const getQuestionsForPosition = (position?: string): Question[] => {
    const roleQuestions =
        position && position in ROLE_QUESTIONS
            ? ROLE_QUESTIONS[position as Position] ?? []
            : [];
    return [...BASE_QUESTIONS, ...roleQuestions];
};
