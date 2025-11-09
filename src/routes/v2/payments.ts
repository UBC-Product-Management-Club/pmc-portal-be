import { Router, Request, Response } from "express";
import { createMembershipPaymentIntent, getOrCreateRSVPCheckoutSession, deleteCheckoutSession, MEMBERSHIP_FEE_NONUBC, MEMBERSHIP_FEE_UBC, saveCheckoutSession } from "../../services/Payment/PaymentService";
import { createCheckoutSession, getOrCreateEventCheckoutSession } from "../../services/Payment/PaymentService";
import { authenticated } from "../../middleware/Session";
import { getAttendee } from "../../services/Attendee/AttendeeService";
import { getEventPriceId } from "../../services/Event/EventService";
import { getUser } from "../../services/User/UserService";

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

paymentRouter.get("/checkout-session/event/:eventId", authenticated, async(req: Request, res: Response) => {
    const userId = req.user?.user_id
    const eventId = req.params.eventId
    if (!userId) return res.status(400).json({ message: "user Id is required!"})
    const attendee = await getAttendee(eventId, userId)
    if (!attendee) return res.status(400).json({ message: `No attendee found ${eventId}:${userId}`})
        
    try {
        const user = await getUser(userId)
        const isMember = user?.is_payment_verified
        const priceId = await getEventPriceId(eventId, !!isMember)
        const session = await getOrCreateEventCheckoutSession(attendee.attendee_id, eventId, userId, priceId);
        return res.status(200).json(session)
    } catch (error) {
        console.log(error)
        return res.status(500).json(error)
    }
})

paymentRouter.get("/checkout-session/rsvp/:eventId", authenticated, async(req: Request, res: Response) => {
    const userId = req.user?.user_id
    const eventId = req.params.eventId
    if (!userId) return res.status(400).json({ message: "user Id is required!"})
    const attendee = await getAttendee(eventId, userId)
    if (!attendee) return res.status(400).json({ message: `No attendee found ${eventId}:${userId}`})
        
    try {
        const user = await getUser(userId)
        const isMember = user?.is_payment_verified
        const priceId = await getEventPriceId(eventId, !!isMember)
        const session = await getOrCreateRSVPCheckoutSession(attendee.attendee_id, eventId, userId, priceId);
        return res.status(200).json(session)
    }
    catch (error) {
        console.log(error)
        return res.status(500).json(error)
    }
})

paymentRouter.delete("/checkout-session/event/:eventId", authenticated, async (req: Request, res: Response) => {
    const userId = req.user?.user_id
    const eventId = req.params.eventId
    if (!userId) return res.status(400).json({ message: "user Id is required!"})
    const attendee = await getAttendee(eventId, userId)
    if (!attendee) return res.status(400).json({ message: `No attendee found ${eventId}:${userId}`})

    try {
        await deleteCheckoutSession(attendee.attendee_id)
        return res.status(200).json({ message: `Deleted checkout session for user ${userId} and event ${eventId}`})
    } catch (error) {
        return res.status(500).json(error)
    }
})