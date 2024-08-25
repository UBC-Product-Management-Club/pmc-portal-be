import { Router } from "express";
import { stripe } from "../config/firebase";
import { addTransaction } from "../controllers/payments/add";


export const paymentRouter = Router()

paymentRouter.post("/add-transaction", async (req, res) => {
    // add transaction to firebase
    try {
        const id = await addTransaction(req.body)
        return res.status(200).json({
            message: `Added transaction with id: ${id}`
        })
    } catch (error) {
        return res.status(500).json({
            message: "Failed to add transaction"
        }) 
    }
})

paymentRouter.post("/membership", async (req, res) => {
    // Create Stripe PaymentIntent for membership fee
    try {
        // TODO: Abstract this
        const paymentIntent = await stripe.paymentIntents.create({
            amount: 1000, // Change to membership fee
            currency: 'cad',
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


