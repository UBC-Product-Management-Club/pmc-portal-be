import dotenv from "dotenv"
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: "./.secret/.env" });

console.log("Database URL: ", process.env.SUPABASE_URL!);
console.log("Key", process.env.SUPABASE_ANON_KEY!);
// Create a single supabase client for interacting with your database
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

export { supabase }