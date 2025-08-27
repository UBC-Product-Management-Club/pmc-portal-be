import { supabase } from "../../config/supabase";
import { User } from "../../schema/v1/User";
import { Database, Tables } from "../../schema/v2/database.types";
import { checkSupabaseUserExists, mapToSupabaseUser } from "./utils";

export const addUser = async (userInfo: User): Promise<{ message: string }> => {
    const { userId } = userInfo;
    try {
        if (await checkSupabaseUserExists(userId)) {
            throw Error("User already exists.");
        }

        const newUser = mapToSupabaseUser(userInfo);

        const { error } = await supabase.from("User").insert(newUser);
        if (error) {
            throw new Error("Error creating user: " + error.message);
        }

        return { message: "success" };
    } catch (error) {
        console.error("Error onboarding user: ", error);
        throw error;
    }
};

export const addUserFromGuestRegistration = async (guestUser: User, userId: string) => {

    const userData: Database["public"]["Tables"]["User"]["Insert"] = { 
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

export const findUserByEmail = async (email: string): Promise<Tables<"User">> => {
  const { data, error } = await supabase
    .from('User')
    .select('*')
    .eq('email', email)
    .single();

  if (error){
    throw new Error(`Failed to find user: ${error.message}`);
  }

  return data;

}

export const getUsers = async (): Promise<Tables<"User">[]> => {
    try {
        const { data, error } = await supabase.from("User").select();
        if (error || !data) {
            throw new Error("Failed to fetch users: " + error?.message);
        }
        return data;
    } catch (error) {
        console.error("Error fetching users: ", error);
        throw error;
    }
};

export const getUser = async (userId: string): Promise<Tables<"User"> | null> => {
    if (!userId) throw Error("User Id is required!")
    try {
        const { data, error } = await supabase.from("User").select().eq("user_id", userId).maybeSingle();

        if (error) {
            throw new Error("Failed to fetch user: " + error.message);
        }
        return data
    } catch (error) {
        console.error("Error fetching user: ", error);
        throw error;
    }
};

// boilerplate
export const exportUsers = async (password: string, isCSV: boolean = false): Promise<{ message: string }> => {
    return { message: `exporting Supabase Users` };
};

