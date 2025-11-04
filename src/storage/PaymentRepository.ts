// src/storage/PaymentRepository.ts
import { supabase } from "../config/supabase";
import { Database } from "../schema/v2/database.types";

type PaymentInsert = Database["public"]["Tables"]["Payment"]["Insert"];

export const PaymentRepository = {
  /**
   * Upsert a payment row (onConflict payment_id)
   */
  logTransaction: async (transaction: PaymentInsert) => {
    const { data, error } = await supabase
      .from("Payment")
      .upsert(transaction, { onConflict: "payment_id" })
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};
