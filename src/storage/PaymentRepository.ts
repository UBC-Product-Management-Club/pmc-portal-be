// src/storage/PaymentRepository.ts
import { supabase } from "../config/supabase";
import { Database } from "../schema/v2/database.types";

type PaymentInsert = Database["public"]["Tables"]["Payment"]["Insert"];

export const PaymentRepository = {
  logTransaction: async (transaction: PaymentInsert) => 
    await supabase
      .from("Payment")
      .upsert(transaction, { onConflict: "payment_id" })
      .select()
      .single()
};
