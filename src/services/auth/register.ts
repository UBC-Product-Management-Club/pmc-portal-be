import Stripe from "stripe";
import { db } from "../../config/firebase";
import { User } from "../../schema/v1/User";

// Handles initial user onboarding and login.
const onboard = async (user: User, payment: Stripe.PaymentIntent): Promise<void> => {
    if (payment.status !== "succeeded") {
        throw Error("Payment failed!")
    }
    if ((await db.collection("users").doc(user.id).get()).exists) {
        throw Error("User already exists!")
    }

    // Create a new document with given UID
    const docRef = db.collection("users").doc(user.id)
    await docRef.set(user)
}

// supabase
const handleSupabaseOnboarding = async (user: User): Promise<{message: string}> => {
    return {message: "success"}
}

export { onboard, handleSupabaseOnboarding };
