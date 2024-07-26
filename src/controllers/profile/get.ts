import { db } from "../../config/firebase";
import { User } from "../../schema/User";
import { userDocument } from "../auth/types";

const getProfile = async (uid: string): Promise<userDocument | undefined> => {
    const docRef = db.collection("users").doc(uid)
    const userRef = await docRef.get()
    return userRef.data() as userDocument | undefined
}

export { getProfile }