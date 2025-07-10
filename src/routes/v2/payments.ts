import { Router } from "express";


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
        //const paymentIntent = await createPaymentIntent(req.body.amt)
        return res.status(200).json({
            message: "supabase success"
        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            message: "Error creating PaymentIntent."
        })
    }
})

paymentRouter.post("/event/:event_id", async (req, res) => {
    // // Create PaymentIntent for given event_id
    // // req must include: user uid, user member status
    // const eventId: string = req.params.event_id
    // const { uid } = req.body
    // const event: Event | null = await getSupabaseEventById(eventId)
    // if (!event) {
    //     return res.status(500).json({
    //         message: `No event found with eventId ${eventId}`
    //     })
    // }

    try {
        // let paymentIntent
        // // If the request was submitted with a UID, then they are a member
        // // If not, then they are a guest
        // if (uid) {
        //     paymentIntent = await createPaymentIntent(+event.member_price)
        // } else {
        //     paymentIntent = await createPaymentIntent(+event.non_member_price)
        // }
        return res.status(200).json({
            message: "success"
        })
    } catch (error) {
        return res.status(500).json({
            message: "Error creating PaymentIntent"
        })
    }

})


