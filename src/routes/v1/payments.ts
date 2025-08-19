import { Router } from "express";
import { createMembershipPaymentIntent, MEMBERSHIP_FEE_NONUBC, MEMBERSHIP_FEE_UBC } from "../../services/Payment/PaymentService";


export const paymentRouter = Router()

interface createPaymentIntentBody {
    type: "membership" | "event",
    options: {[key: string]: string}
}
paymentRouter.get("/membership", async (req, res) => {
    return res.status(200).json({
        ubcPrice: MEMBERSHIP_FEE_UBC,
        nonUbcPrice: MEMBERSHIP_FEE_NONUBC 
    })
})

paymentRouter.get("/event/:eventId", async (req, res) => {
    // TODO: fetch event price and return
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

// paymentRouter.get("/create", async (req, res) => {
//     // make this take in query params
//     const data: createPaymentIntentBody = req.body
//     try {
//         return res.status(200).json({
//             paymentSecret: createPaymentIntent(data).client_secret
//         })
//     }

//     // if () {
//     //     return res.status(400).json({
//     //         message: "Missing info!"
//     //     })
//     // }
//     console.log(paymentIntent)
// })


export type {createPaymentIntentBody}