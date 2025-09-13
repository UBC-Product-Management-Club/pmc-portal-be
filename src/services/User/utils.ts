import { Parser } from "@json2csv/plainjs";
import { User, UserExportFields, exportUserFieldNames } from "../../schema/v1/User";
import { supabase } from "../../config/supabase";
import _ from "lodash";

const TABLES = {
    USER: "User",
    ATTENDEE: "Attendee",
    EVENT: "Event",
    PAYMENT: "Payment",
} as const;

async function checkSupabaseUserExists(user: User) {
    const { data, error } = await supabase.from(TABLES.USER).select().eq("user_id", user.userId).maybeSingle();
    if (error) {
        throw new Error("Failed to verify if user already exists: " + error.message);
    }

    return !!data;
}

function mapToSupabaseUser(userInfo: User) {
    return {
        user_id: userInfo.userId,
        first_name: userInfo.firstName,
        last_name: userInfo.lastName,
        display_name: userInfo.displayName,
        why_pm: userInfo.whyPm,
        pronouns: userInfo.pronouns,
        university: userInfo.university,
        faculty: userInfo.faculty,
        email: userInfo.email,
        year: userInfo.year,
        major: userInfo.major,
        pfp: userInfo.pfp,
        student_id: userInfo.studentId,
        is_payment_verified: false,
    };
}

const formatCSV = (users: UserExportFields[]) => {
    const parser = new Parser({
        fields: [...exportUserFieldNames],
    });
    return parser.parse(users);
};

export { formatCSV, checkSupabaseUserExists, mapToSupabaseUser };
