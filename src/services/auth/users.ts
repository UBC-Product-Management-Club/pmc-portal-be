import { db } from "../../config/firebase";
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
