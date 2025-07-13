import { Router } from "express";
import { addTransaction } from "../../services/payments/add";
import { getEventById } from "../../services/events/event";
import { FirebaseEvent } from "../../schema/v1/FirebaseEvent";
import { createMembershipPaymentIntent, MEMBERSHIP_FEE_NONUBC, MEMBERSHIP_FEE_UBC } from "../../services/payments/PaymentService";


export const paymentRouter = Router()

interface createPaymentIntentBody {
    type: "membership" | "event",
    options: {[key: string]: string}
}

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

paymentRouter.get("/membership", async (req, res) => {
    return res.status(200).json({
        ubcPrice: MEMBERSHIP_FEE_UBC,
        nonUbcPrice: MEMBERSHIP_FEE_NONUBC 
    })
})


paymentRouter.post("/event/:event_id", async (req, res) => {
    // Create PaymentIntent for given event_id
    // req must include: user uid, user member status
    const eventId: string = req.params.event_id
    const { uid } = req.body
    const event: FirebaseEvent | null = await getEventById(eventId)
    if (!event) {
        return res.status(500).json({
            message: `No event found with eventId ${eventId}`
        })
    }
})

paymentRouter.get("/event/:eventId", async (req, res) => {
    // TODO: fetch event price and return
})

paymentRouter.get("/create/membership", async (req, res) => {
    const isUbcStudent = req.query["ubc"]
    if (!isUbcStudent) {
        return res.status(400).json({
            message: "Missing info!"
        })
    }
    try {
        const paymentIntent = await createMembershipPaymentIntent(isUbcStudent === "true")
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