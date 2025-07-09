import { Parser } from "@json2csv/plainjs";
import { SupabaseUser, userDocument, UserExportFields } from "./types";
import { db } from "../../config/firebase";
import { exportUserFieldNames } from "./types";
import { supabase } from "../../config/supabase";

async function checkUserExists(uid: string) {
    const userRef = db.collection("users").doc(uid);
    const user = await userRef.get();
    return user.exists;
}

const TABLES = {
    USER: "User",
    ATTENDEE: "Attendee",
    PAYMENT: "Payment",
};

const schema = process.env.SUPABASE_SCHEMA || "public";

// uses schema to get data from specific table
const fromTable = (table: string) => {
    return supabase.from(schema === "public" ? table : `${schema}.${table}`);
};

async function checkSupabaseUserExists(uid: string) {
    try {
        const { data, error } = await fromTable(TABLES.USER).select("user_id").eq("user_id", uid).maybeSingle();

        if (error) {
            throw new Error("Failed to check user existence: " + error.message);
        }

        return !!data;
    } catch (error) {
        console.error("Error checking user existence: ", error);
        throw error;
    }
}

const mapToSupabaseUser = (userDoc: userDocument, uid: string): SupabaseUser => {
    return {
        user_id: uid,
        first_name: userDoc.first_name,
        last_name: userDoc.last_name,
        is_ubc_student: null,
        display_name: userDoc.displayName,
        why_pm: userDoc.why_PM,
        pronouns: userDoc.pronouns ?? null,
        university: userDoc.university ?? null,
        faculty: userDoc.faculty ?? null,
        email: userDoc.email,
        year: userDoc.year ?? null,
        major: userDoc.major ?? null,
        pfp: null,
        is_returning_member: userDoc.returning_member ?? null,
        is_payment_verified: userDoc.paymentVerified,
        student_id: userDoc.student_id ? String(userDoc.student_id) : null,
    };
};

const formatCSV = (users: UserExportFields[]) => {
    const parser = new Parser({
        fields: [...exportUserFieldNames],
    });
    return parser.parse(users);
};

export { checkUserExists, checkSupabaseUserExists, formatCSV, mapToSupabaseUser, fromTable, TABLES };
