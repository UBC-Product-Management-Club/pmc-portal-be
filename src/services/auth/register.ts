import { memberOnboardingInfo, UserRequiredFields } from "./types";
import { db } from "../../config/firebase";
import { checkUserExists, checkSupabaseUserExists, mapToSupabaseUser, fromTable, TABLES } from "./utils";
import { supabase } from "../../config/supabase";

// Handles initial user onboarding and login.
const handleOnboarding = async (onboardInfo: memberOnboardingInfo): Promise<void> => {
    const { creds, userDoc }: memberOnboardingInfo = onboardInfo;
    if (await checkUserExists(creds.userUID)) {
        throw Error("User already exists.");
    }

    // Create a new document with given UID
    const docRef = db.collection("users").doc(creds.userUID);
    try {
        await docRef.set(userDoc);
    } catch (error) {
        throw Error("Error creating user");
    }
};

// supabase
const handleSupabaseOnboarding = async (onboardInfo: memberOnboardingInfo): Promise<{ message: string }> => {
    const { creds, userDoc }: memberOnboardingInfo = onboardInfo;
    try {
        if (await checkSupabaseUserExists(creds.userUID)) {
            throw Error("User already exists.");
        }

        const newUser = mapToSupabaseUser(userDoc, creds.userUID);

        const { error } = await fromTable(TABLES.USER).insert([newUser]);
        if (error) {
            throw new Error("Error creating user: " + error.message);
        }

        return { message: "success" };
    } catch (error) {
        console.error("Error onboarding user: ", error);
        throw error;
    }
};

export { handleOnboarding, handleSupabaseOnboarding };
