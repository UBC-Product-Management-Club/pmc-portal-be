import { User } from "../../schema/v1/User";
import { checkSupabaseUserExists, mapToSupabaseUser, TABLES } from "./utils";
import { supabase } from "../../config/supabase";
import { Database } from "../../schema/v2/database.types";

type UserInsert = Database['public']['Tables']['User']['Insert'];
type UserRow = Database['public']['Tables']['User']['Row'];

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
    const { userId } = userInfo;
    try {
        if (await checkSupabaseUserExists(userId)) {
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

const addUserFromGuestRegistration = async (guestUser: any, userId: string) => {

    const userData: UserInsert = { 
        first_name: guestUser.firstName,
        last_name:guestUser.lastName,
        student_id:guestUser.studentId,
        email:guestUser.email,
        university:guestUser.university,
        faculty: guestUser.faculty,
        major: guestUser.major,
        pronouns:guestUser.pronouns,
        user_id:userId,
    }

    const { data, error } = await supabase
        .from('User')
        .insert(userData)
        .select()
        .single();
    
    if (!data || error){
        throw new Error(`Error inserting guestUser: ${error?.message}`);
    }
    
}

const findUserByEmail = async (email: string): Promise<UserRow | null> => {
  const { data, error } = await supabase
    .from('User')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (error){
    throw new Error(`Failed to find user: ${error.message}`);
  }

  return data;

}

export { handleSupabaseOnboarding, addUserFromGuestRegistration, findUserByEmail};
