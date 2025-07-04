import { Router } from "express";
import { addTransaction } from "../../services/payments/add";
import { createPaymentIntent } from "../../services/payments/create";
import { getEventById } from "../../services/events/event";
import { Event } from "../../schema/Event";


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
        const paymentIntent = await createPaymentIntent(req.body.amt)
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
    // req must include: user uid, user member status
    const eventId: string = req.params.event_id
    const { uid } = req.body
    const event: Event | null = await getEventById(eventId)
    if (!event) {
        return res.status(500).json({
            message: `No event found with eventId ${eventId}`
        })
    }

    try {
        let paymentIntent
        // If the request was submitted with a UID, then they are a member
        // If not, then they are a guest
        if (uid) {
            paymentIntent = await createPaymentIntent(+event.member_price)
        } else {
            paymentIntent = await createPaymentIntent(+event.non_member_price)
        }
        return res.status(200).json({
            payment_secret: paymentIntent.client_secret
        })
    } catch (error) {
        return res.status(500).json({
            message: "Error creating PaymentIntent"
        })
    }

})


