import { db } from "../../config/firebase";
import { formatCSV, TABLES } from "./utils";
import { supabase } from "../../config/supabase";
import { exportUserFieldNames, UserExportFields, UserRequiredFields } from "../../schema/v1/User";

export const getAllUsers = async (): Promise<UserRequiredFields[]> => {
    try {
        const users = await db.collection("users").get();

        return users.docs.map((doc) => ({ ...doc.data(), id: doc.id } as UserRequiredFields));
    } catch (error) {
        console.error("Error fetching users: ", error);
        throw error;
    }
};

export const exportUsers = async (password: string, isCSV: boolean = false): Promise<UserExportFields[] | string> => {
    try {
        if (password !== process.env.EXPORT_PASSWORD) {
            throw new Error("Invalid password");
        }

        const users = await db
            .collection("users")
            .select(...exportUserFieldNames)
            .get();

        const formattedUsers = users.docs.map((doc) => {
            const data = doc.data();
            return {
                ...Object.fromEntries(exportUserFieldNames.map((key) => [key, data[key] ?? null])),
                id: doc.id,
            } as UserExportFields;
        });

        return isCSV ? formatCSV(formattedUsers) : formattedUsers;
    } catch (error) {
        console.error("Error fetching users: ", error);
        throw error;
    }
};

// supabase services

export const getAllSupabaseUsers = async (): Promise<UserRequiredFields[]> => {
    try {
        const { data, error } = await supabase.from(TABLES.USER).select();
        if (error || !data) {
            throw new Error("Failed to fetch users: " + error?.message);
        }
        return data;
    } catch (error) {
        console.error("Error fetching users: ", error);
        throw error;
    }
};

export const getSupabaseUserByID = async (userID: string): Promise<UserRequiredFields | undefined> => {
    try {
        const { data, error } = await supabase.from(TABLES.USER).select().eq("user_id", userID).maybeSingle();

        if (error) {
            throw new Error("Failed to fetch user: " + error.message);
        }

        return data as UserRequiredFields;
    } catch (error) {
        console.error("Error fetching user: ", error);
        throw error;
    }
};

// boilerplate
export const exportSupabaseUsers = async (password: string, isCSV: boolean = false): Promise<{ message: string }> => {
    return { message: `exporting Supabase Users` };
};
