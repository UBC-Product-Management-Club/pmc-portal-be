import { db } from "../../config/firebase";
import { exportUserFieldNames, UserExportFields, UserRequiredFields } from "./types";
import { formatCSV } from "./utils";
import {supabase} from "../../config/supabase";

export const getAllUsers = async (): Promise<UserRequiredFields[]> => {
    try {
        const users = await db.collection("users").get();

        return users.docs.map((doc) => ({ ...doc.data(), id: doc.id } as UserRequiredFields));
    } catch (error) {
        console.error("Error fetching users: ", error);
        throw error;
    }
};

export const getAllSupabaseUsers = async (): Promise<UserRequiredFields[]> => {
    try {
        const {data, error} = await supabase.from('User').select();
        if (error || !data) {
            throw new Error('Failed to fetch users: ' + error?.message);
        }
        return data;

    } catch (error) {
        console.error("Error fetching users: ", error);
        throw error;
    }
}

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
