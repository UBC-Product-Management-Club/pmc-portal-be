import { db } from "../../config/firebase";
import { addTransactionBody } from "../../schema/Transaction";

const addTransaction = async (transaction: addTransactionBody) : Promise<string>=> {
    await db.collection("transactions").doc(transaction.payment.id).set(transaction)
    return transaction.payment.id
}

export { addTransaction }