import { db } from "../../config/firebase";
import {supabase} from "../../config/supabase";
import { UserRequiredFields } from "./types";

export const getAllUsers = async (): Promise<UserRequiredFields[]> => {
    try {
        const users = await db.collection("users").get();
        return users.docs.map((doc) => ({...doc.data(), id: doc.id} as UserRequiredFields));
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
        data.push(data.length)
        return data;

    } catch (error) {
        console.error("Error fetching users: ", error);
        throw error;
    }
}
