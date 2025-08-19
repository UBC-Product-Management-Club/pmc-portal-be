import { Router } from "express";
import { createMembershipPaymentIntent, MEMBERSHIP_FEE_NONUBC, MEMBERSHIP_FEE_UBC } from "../../services/Payment/PaymentService";
import { createCheckoutSession } from "../../services/Payment/PaymentService";

export const paymentRouter = Router()

paymentRouter.get("/membership", async (req, res) => {
    return res.status(200).json({
        ubcPrice: MEMBERSHIP_FEE_UBC,
        nonUbcPrice: MEMBERSHIP_FEE_NONUBC 
    })
})

paymentRouter.get("/create/membership", async (req, res) => {
    try {
        const userId = req.query["userId"] as string
        if (!userId) throw Error("userId is required!")
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


