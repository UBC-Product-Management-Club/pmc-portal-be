import { db } from "../../config/firebase";
import {supabase} from "../../config/supabase";
import { UserRequiredFields } from "./types";

export const getAllUsers = async () => {
    try {
        const users = await db.collection("users").get();
        return users.size;
    } catch (error) {
        console.error("Error fetching users: ", error);
        throw error;
    }
}


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
