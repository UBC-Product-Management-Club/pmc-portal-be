import { db } from "../../config/firebase"

async function checkUserExists(uid: string) {
    const userRef = db.collection("users").doc(uid)
    const user = await userRef.get()
    return user.exists
}

export { checkUserExists }
