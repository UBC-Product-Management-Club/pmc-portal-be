import { supabase } from "../config/supabase";
import { TablesInsert } from "../../src/schema/v2/database.types";

type UserInsert = TablesInsert<"User">;

export const UserRepository = {
  addUser: (user: UserInsert) =>
    supabase.from("User").upsert(user).select().single(),

  addUserFromGuestRegistration: (user: UserInsert) =>
    supabase.from("User").insert(user).select().single(),

  updateUser: (userId: string, updates: Record<string, any>) =>
    supabase.from("User").update(updates).eq("user_id", userId).single(),
  findUserByEmail: (email: string) =>
    supabase.from("User").select("*").eq("email", email).single(),

  getUsers: () => supabase.from("User").select("*"),

  getUser: (userId: string) =>
    supabase.from("User").select("*").eq("user_id", userId).maybeSingle(),
  getEmailByUserId: (userId: string) => supabase.from("User").select("email").eq("user_id", userId).single(),
  exportUsers: (password: string, isCSV: boolean = false) => {
    // boilerplate: repository should NOT perform export logic
    return Promise.resolve({ message: "exporting Supabase Users" });
  },
};
