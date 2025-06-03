import { stripe } from "../../config/firebase"


// amt must be in dollars (e.g. $10.50 = 10.50)
const createPaymentIntent = async (amt: number) => {
    // Convert to cents and round to avoid floating point issues
    const amountInCents = Math.round(amt * 100)
    
    return await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: 'cad',
        automatic_payment_methods: {
            enabled: true,
        }
    })
}

export { createPaymentIntent }