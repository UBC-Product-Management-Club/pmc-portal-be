import {db} from "../../config/firebase";

export const deleteUser = async (uid: string): Promise<void> => {
    const docRef = db.collection("users").doc(uid)
    await docRef.delete()
}