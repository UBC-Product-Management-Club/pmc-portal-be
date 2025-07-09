type userDocument = {
    id: string;
    first_name: string;
    last_name: string;
    pronouns: string;
    email: string; // from google
    displayName: string; // from Google
    university: string;
    student_id: number;
    year: string; // "5+"
    faculty: string;
    major: string;
    why_PM: string;
    returning_member: boolean;
    attendee_ids: string[];
    paymentVerified?: boolean;
    exists?: boolean;
    onboarded?: boolean;
};

type SupabaseUser = {
    user_id: string;
    first_name: string;
    last_name: string;
    is_ubc_student: boolean | null;
    display_name: string;
    why_pm: string;
    pronouns?: string | null;
    university?: string | null;
    faculty?: string | null;
    email: string;
    year?: string | null;
    major?: string | null;
    pfp?: string | null;
    is_returning_member?: boolean | null;
    is_payment_verified?: boolean;
    student_id?: string | null;
};

type UserRequiredFields = Pick<
    userDocument,
    "id" | "first_name" | "last_name" | "email" | "university" | "student_id" | "year" | "faculty" | "major" | "why_PM" | "returning_member" | "paymentVerified"
>;

const exportUserFieldNames = ["id", "first_name", "last_name", "email", "university", "student_id", "year", "faculty", "major", "paymentVerified"] as const;

type UserExportFields = Pick<userDocument, (typeof exportUserFieldNames)[number]>;

type memberOnboardingInfo = {
    creds: loginReqBody;
    userDoc: userDocument;
};

type paymentInfo = {
    id: string;
    amount: number;
    status: string;
    created: number;
};

type membershipPaymentInfo = {
    type: "membership";
    member_id?: string;
    attendee_id?: string;
    payment: paymentInfo;
};

type onboardingReqBody = {
    onboardingInfo: memberOnboardingInfo;
    paymentInfo: membershipPaymentInfo;
};

type loginReqBody = {
    userUID: string;
    idToken: string;
};

type loginResponse = {
    sessionCookie: string;
    options: {
        maxAge: number;
        httpOnly: boolean;
        secure: boolean;
    };
};

export { onboardingReqBody, loginReqBody, loginResponse, userDocument, UserRequiredFields, memberOnboardingInfo, UserExportFields, exportUserFieldNames, SupabaseUser };
