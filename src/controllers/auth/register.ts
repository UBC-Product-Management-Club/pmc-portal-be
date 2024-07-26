import { loginReqBody, loginResponse, onboardingReqBody, userDocument } from "./types";
import { db } from "../../config/firebase";
import { handleLogin } from "./login";
import { checkUserExists } from "./utils";


// Handles initial user onboarding and login.
const handleOnboarding = async (creds: loginReqBody, userDoc: userDocument): Promise<void> => {
    if (await checkUserExists(creds.userUID)) {
        throw Error("User already exists.")
    }

    // Create a new document with given UID
    const docRef = db.collection("users").doc(creds.userUID)
    try {
        await docRef.set(userDoc)
    } catch (error) {
        throw Error("Error creating user")
    }
}


export { handleOnboarding }