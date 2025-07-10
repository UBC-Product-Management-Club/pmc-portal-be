import dotenv from "dotenv"
import { createClient, SupabaseClient } from '@supabase/supabase-js'

dotenv.config({ path: "./.secret/.env" });

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing required Supabase environment variables"
    );
  }

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

export { supabase }