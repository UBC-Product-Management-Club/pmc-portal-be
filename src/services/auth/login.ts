import { db } from "../../config/firebase";
import { checkSupabaseUserExists } from "./utils";

// TODO: create types for user auth
const handleLogin = async (userId: string): Promise<any> => {
    if (!userId) {
        throw Error("400: Bad request");
    }
    try {
        const userRef = db.collection("users").doc(userId);
        const user = await userRef.get();
        return user.data();
    } catch (error) {
        throw Error("500: something went wrong fetching users");
    }
};

//supabase
const handleSupabaseLogin = async (uid: string): Promise<boolean> => {
    if (!uid) {
        throw Error("400: Bad request");
    }
    try {
        return checkSupabaseUserExists(uid);
    } catch (error) {
        throw Error("500: something went wrong fetching users");
    }
};

// Checks if the current userRef exists.
export { handleLogin, handleSupabaseLogin };
