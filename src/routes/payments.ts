import { Router } from "express";
import { stripe } from "../config/firebase";


export const paymentRouter = Router()

paymentRouter.post("/membership", async (req, res) => {
    // Create Stripe PaymentIntent for membership fee
    try {
        // TODO: Abstract this
        const paymentIntent = await stripe.paymentIntents.create({
            amount: 1000, // Change to membership fee
            currency: 'usd',
            automatic_payment_methods: {
                enabled: true,
            }
        })
        return res.status(200).json({
            payment_secret: paymentIntent.client_secret
        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            message: "Error creating PaymentIntent."
        })
    }
})

paymentRouter.post("/event/:event_id", async (req, res) => {
    // Create PaymentIntent for given event_id
    // req must include user  
})

