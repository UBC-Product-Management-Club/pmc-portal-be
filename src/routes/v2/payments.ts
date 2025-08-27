import { Router, Request, Response } from "express";
import { createMembershipPaymentIntent, MEMBERSHIP_FEE_NONUBC, MEMBERSHIP_FEE_UBC } from "../../services/Payment/PaymentService";
import { createCheckoutSession } from "../../services/Payment/PaymentService";
import { authenticated } from "../../middleware/Session";

export const paymentRouter = Router()

paymentRouter.get("/membership", async (req, res) => {
    return res.status(200).json({
        ubcPrice: MEMBERSHIP_FEE_UBC,
        nonUbcPrice: MEMBERSHIP_FEE_NONUBC 
    })
})

paymentRouter.get("/create/membership", authenticated, async (req: Request, res: Response) => {
    const userId = req.user?.user_id
    if (!userId) throw Error("userId is required!")
        
    try {
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

paymentRouter.get("/checkout-session/membership", authenticated, async(req: Request, res: Response) => {
    const userId = req.user?.user_id
    if (!userId) throw Error("userId is required!")

    try {
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


