import { loginReqBody, loginResponse, onboardingReqBody, userDocument } from "./types";
import { db } from "../../config/firebase";
import { handleLogin } from "./login";
import { checkUserExists } from "./utils";


// Handles initial user onboarding and login.
const handleOnboarding = async (creds: loginReqBody, userDoc: userDocument): Promise<loginResponse> => {
    if (await checkUserExists(creds.userUID)) {
        throw Error("User already exists.")
    }

    // Create a new document with given UID
    const docRef = db.collection("users").doc(creds.userUID)
    try {

        // might throw unsupported doc error
        await docRef.set(userDoc)

        // Log user in
        const session = await handleLogin(creds.userUID, creds.idToken)
        return session
    } catch (error) {
        // An error occurred? Delete the document
        console.log(error)
        throw Error("User creation failed.")
    }
}


export { handleOnboarding }