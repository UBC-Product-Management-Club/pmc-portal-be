import { Router } from "express";
import { addTransaction } from "../../services/payments/add";
//import { createPaymentIntent } from "../../services/payments/create";
import { getEventById, getSupabaseEventById } from "../../services/events/event";
import { createMembershipPaymentIntent } from "../../services/payments/PaymentService";

export const paymentRouter = Router()

paymentRouter.post("/add-transaction", async (req, res) => {
    // add transaction to supabase
    try {
        //const id = await addSupabaseTransaction(req.body)
        return res.status(200).json({
            message: `Added supabase transaction`
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
        const userId = req.body.userId;
        const paymentIntent = await createMembershipPaymentIntent(userId);
        return res.status(201).json({
            clientSecret: paymentIntent.client_secret
        })
    }
    catch (error) {
        console.log(error)
        return res.status(500).json({
            message: "Error creating PaymentIntent."
        })
    }
})

paymentRouter.post("/event/:event_id", async (req, res) => {
    // Create PaymentIntent for given event_id
    // req must include: user uid, user member status
    // try {
    //     const userId = req.body.userId;
    //     const type = "event";
    //     const eventId = req.params.event_id  
    //     const paymentIntent = await createEventPaymentIntent(userId,eventId)
    //     return res.status(201).json({
    //         clientSecret: paymentIntent.client_secret
    //     })
    // }
    // catch (error) {
    //     console.log(error)
    //     return res.status(500).json({
    //         message: "Error creating PaymentIntent."
    //     })
    // }

})


