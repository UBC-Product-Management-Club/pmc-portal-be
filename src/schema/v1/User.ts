interface User {
    id: string;
    displayName: string;
    firstName: string;
    lastName: string;
    pronouns: string;
    email: string;
    university: string;
    faculty: string;
    year: string;
    major: string;
    pfp: string;
    studentId: number;
    whyPm: string;
}

type UserRequiredFields = Pick<User, "id" | "firstName" | "lastName" | "email" | "university" | "studentId" | "year" | "faculty" | "major" | "whyPm">;

const exportUserFieldNames = ["id", "firstName", "lastName", "email", "university", "studentId", "year", "faculty", "major"] as const;

type UserExportFields = Pick<User, (typeof exportUserFieldNames)[number]>;

export { User, UserRequiredFields, UserExportFields, exportUserFieldNames };
