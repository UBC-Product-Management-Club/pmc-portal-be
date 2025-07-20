import dotenv from "dotenv";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Database } from "../schema/v2/database.types";

dotenv.config({ path: "./.secret/.env" });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing required Supabase environment variables");
}

const supabase: SupabaseClient = createClient<Database>(supabaseUrl, supabaseKey);

export { supabase };
