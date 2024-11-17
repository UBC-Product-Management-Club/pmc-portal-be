import { db } from "../../config/firebase";

export const getAllUsers = async () => {
    try {
        const users = await db.collection("users").get();
        return users.docs.map((doc) => doc.data());
    } catch (error) {
        console.error("Error fetching users: ", error);
        throw error;
    }
}
