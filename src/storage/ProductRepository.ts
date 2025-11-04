import { supabase } from "../config/supabase";

export const ProductRepository = {
    getPriceId: (productId: string) => supabase.from("Products").select("product").eq("id", productId).single()
}