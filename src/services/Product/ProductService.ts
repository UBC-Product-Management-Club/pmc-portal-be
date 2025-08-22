//fetchMembershipPriceId(isUBC) : if isUbc, supabase.select('generated uuuid'),

import { supabase } from "../../config/supabase";
import { Database } from "../../schema/v2/database.types";

type Product = Database["public"]["Tables"]["Products"]["Row"]["product"];

async function fetchMembershipPriceId(isUBC: boolean): Promise<Product> {
    const UBC_PRICE_ID = '28b6e39a-c480-4e66-87e7-af9be35b8c0d'
    const NON_UBC_PRICE_ID = '8be9546d-16d4-473f-851b-6e4603f11a61'

    const id = isUBC ? UBC_PRICE_ID : NON_UBC_PRICE_ID

    const { data, error } = await supabase.from("Products").select("product").eq("id", id).single();

    if (error) {
        throw new Error(error.message);
    }

    return data.product
}


export {fetchMembershipPriceId}