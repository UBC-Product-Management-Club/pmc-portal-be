import { memberOnboardingInfo } from "./types";
import { db } from "../../config/firebase";
import { checkUserExists } from "./utils";


// Handles initial user onboarding and login.
const handleOnboarding = async (onboardInfo: memberOnboardingInfo): Promise<void> => {
    const { creds, userDoc }: memberOnboardingInfo = onboardInfo
    // if (await checkUserExists(creds.userUID)) {
    //     throw Error("User already exists.")
    // }

    // Create a new document with given UID
    const docRef = db.collection("users").doc(creds.userId)
    try {
        await docRef.set(userDoc)
    } catch (error) {
        throw Error("Error creating user")
    }
}


export { handleOnboarding }