import { Router } from "express";
import { createCheckoutSession, createMembershipPaymentIntent, MEMBERSHIP_FEE_NONUBC, MEMBERSHIP_FEE_UBC } from "../../services/payments/PaymentService";

export const paymentRouter = Router()

paymentRouter.get("/membership", async (req, res) => {
    return res.status(200).json({
        ubcPrice: MEMBERSHIP_FEE_UBC,
        nonUbcPrice: MEMBERSHIP_FEE_NONUBC 
    })
})

paymentRouter.get("/create/membership", async (req, res) => {
    
    try {
        const userId = req.body.userId;
        const paymentIntent = await createMembershipPaymentIntent(userId)
        if (!paymentIntent.client_secret) {
            throw new Error("Client secret was null!")
        }
        return res.status(201).json({
            clientSecret: paymentIntent.client_secret
        })
    } catch (e) {
        return res.status(400).json({
            message: e
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

paymentRouter.post("/checkout-session/membership", async(req, res) => {
    try {
        const userId = req.body.userId;
        const session = await createCheckoutSession(userId);
        return res.json({url: session.url})
    }
    catch (error) {
        console.log(error)
        return res.status(500).json({
            message: "Error creating checkout session."
        })
    }
})


