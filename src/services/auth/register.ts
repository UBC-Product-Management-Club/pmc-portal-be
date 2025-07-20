import { User } from "../../schema/v1/User";
import { checkSupabaseUserExists, mapToSupabaseUser, TABLES } from "./utils";
import { supabase } from "../../config/supabase";

// Handles initial user onboarding and login.
// const handleOnboarding = async (onboardInfo: memberOnboardingInfo): Promise<void> => {
//     const { creds, userDoc }: memberOnboardingInfo = onboardInfo;
//     if (await checkUserExists(creds.userUID)) {
//         throw Error("User already exists.");
//     }

//     // Create a new document with given UID
//     const docRef = db.collection("users").doc(creds.userUID);
//     try {
//         await docRef.set(userDoc);
//     } catch (error) {
//         throw Error("Error creating user");
//     }
// };

// supabase
const handleSupabaseOnboarding = async (userInfo: User): Promise<{ message: string }> => {
    const { id } = userInfo;
    try {
        if (await checkSupabaseUserExists(id)) {
            throw Error("User already exists.");
        }

        const newUser = mapToSupabaseUser(userInfo);

        const { error } = await supabase.from(TABLES.USER).insert([newUser]);
        if (error) {
            throw new Error("Error creating user: " + error.message);
        }

        return { message: "success" };
    } catch (error) {
        console.error("Error onboarding user: ", error);
        throw error;
    }
};

export { handleSupabaseOnboarding };
