import { db } from "../../config/firebase";
import { User } from "../../schema/User";

const getProfile = async (uid: string) => {
    const docRef = db.collection("users").doc(uid)
    const userRef = await docRef.get()
    if (userRef.exists) {
        const user = userRef.data() as User
        return {...user}
    } else {
        // console.log("throw error")
        throw Error("User doesn't exist")
    }
}

export { getProfile }