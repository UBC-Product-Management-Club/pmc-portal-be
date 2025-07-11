import { Parser } from "@json2csv/plainjs";
import { User, UserExportFields, exportUserFieldNames } from "../../schema/User";
import { db } from "../../config/firebase";
import { supabase } from "../../config/supabase";

const TABLES = {
    USER: "User",
    ATTENDEE: "Attendee",
    EVENT: "Event",
    PAYMENT: "Payment",
} as const;

async function checkUserExists(uid: string) {
    const userRef = db.collection("users").doc(uid);
    const user = await userRef.get();
    return user.exists;
}

async function checkSupabaseUserExists(id: string) {
    try {
        const { data, error } = await supabase.from(TABLES.USER).select().eq("user_id", id).maybeSingle();
        if (error) {
            throw new Error("Error creating user: " + error.message);
        }

        return !!data;
    } catch (error) {
        console.error("Error onboarding user: ", error);
        throw error;
    }
}

function mapToSupabaseUser(userInfo: User) {
    return {
        user_id: userInfo.id,
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

export { checkUserExists, formatCSV, checkSupabaseUserExists, TABLES, mapToSupabaseUser };
