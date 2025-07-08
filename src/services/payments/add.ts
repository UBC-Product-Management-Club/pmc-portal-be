import { db } from "../../config/firebase";
import { addTransactionBody } from "../../schema/v1/Transaction";

const addTransaction = async (transaction: addTransactionBody) : Promise<string>=> {
    await db.collection("transactions").doc(transaction.payment.id).set(transaction)
    return transaction.payment.id
}

//supabase 

const addSupabaseTransaction = async (transaction: addTransactionBody) : Promise<string>=> {
    
    return "success"
}

export { addTransaction, addSupabaseTransaction }