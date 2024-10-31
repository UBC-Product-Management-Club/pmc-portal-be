import { stripe } from "../../config/firebase"


// amt must be in the lowest currency unit (cents). So $10 = 1000
const createPaymentIntent = async (amt: number) => {
    return await stripe.paymentIntents.create({
        amount: amt * 100, 
        currency: 'cad',
        automatic_payment_methods: {
            enabled: true,
        }
    })
}

export { createPaymentIntent }