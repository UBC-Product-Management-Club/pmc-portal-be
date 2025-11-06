import { User } from "../../schema/v1/User";
import { Database, Tables } from "../../schema/v2/database.types";
import { mapToSupabaseUser } from "./utils";
import { UserRepository } from "../../storage/UserRepository";

export const addUser = async (userInfo: User): Promise<{ message: string }> => {
  try {
    const newUser = mapToSupabaseUser(userInfo);
    const { error } = await UserRepository.addUser(newUser);

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
    last_name: guestUser.lastName,
    student_id: guestUser.studentId,
    email: guestUser.email,
    university: guestUser.university,
    faculty: guestUser.faculty,
    major: guestUser.major,
    pronouns: guestUser.pronouns,
    user_id: userId,
  };

  const { data, error } = await UserRepository.addUserFromGuestRegistration(userData);

  if (!data || error) {
    throw new Error(`Error inserting guestUser: ${error?.message}`);
  }

  return data;
};

export const findUserByEmail = async (email: string): Promise<Tables<"User">> => {
  const { data, error } = await UserRepository.findUserByEmail(email);

  if (error) {
    throw new Error(`Failed to find user: ${error.message}`);
  }

  return data!;
};

export const getUsers = async (): Promise<Tables<"User">[]> => {
  try {
    const { data, error } = await UserRepository.getUsers();

    if (error || !data) {
      throw new Error("Failed to fetch users: " + error?.message);
    }

    return data;
  } catch (error) {
    console.error("Error fetching users: ", error);
    throw error;
  }
};

/**
 * Fetch user by user_id
 */
export const getUser = async (userId: string): Promise<Tables<"User"> | null> => {
  if (!userId) throw Error("User Id is required!");

  try {
    const { data, error } = await UserRepository.getUser(userId);

    if (error) {
      throw new Error("Failed to fetch user: " + error.message);
    }

    return data ?? null;
  } catch (error) {
    console.error("Error fetching user: ", error);
    throw error;
  }
};

export const exportUsers = async (password: string, isCSV: boolean = false): Promise<{ message: string }> => {
  return { message: `exporting Supabase Users` };
};
