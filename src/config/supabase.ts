import dotenv from "dotenv"
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { useEnvironment } from "../utils/useEnvironment";

dotenv.config({ path: "./.secret/.env" });
const { isProd } = useEnvironment();

const supabaseUrl =
    isProd
      ? process.env.PROD_SUPABASE_URL
      : process.env.STAGING_SUPABASE_URL;

const supabaseKey = 
    isProd
      ? process.env.PROD_SUPABASE_SERVICE_ROLE_KEY
      : process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing required Supabase environment variables"
    );
  }

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

export { supabase }