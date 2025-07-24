import { Router } from "express";
import { getSupabaseEventById, getSupabaseEvents } from "../../services/events/event";
import { Attendee, FirebaseEvent } from "../../schema/v1/FirebaseEvent"
import multer from "multer"
import { addAttendee, addSupabaseAttendee, getAttendeeById, registerGuestForEvent } from "../../services/events/attendee";
import { addTransaction } from "../../services/payments/add";
import { addTransactionBody } from "../../schema/v1/Transaction";
import { sendEmail } from "../../services/emails/send";
import { checkIsRegistered } from "../../services/events/attendee";
import { Database } from "../../schema/v2/database.types";


type AttendeeInsert = Database['public']['Tables']['Attendee']['Insert'];
type UserInsert = Database['public']['Tables']['User']['Insert'];

export const eventRouter = Router()

eventRouter.get('/', async (req, res) => {
    try {
        const events = await getSupabaseEvents();
        res.status(200).json(events);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

eventRouter.get('/:id', async (req, res) => {
    try {
        const eventByID = await getSupabaseEventById(req.params.id);
        res.status(200).json(eventByID);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

eventRouter.post('/:eventId/register/member', async (req, res) => {
    try {
        const userId = req.body.userId;
        const paymentId = req.body.paymentId;
        const eventId = req.params.eventId;
        const eventFormAnswers = req.body.eventFormAnswers;
        
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const insertData: AttendeeInsert = {
            user_id: userId,
            event_id:eventId,
            payment_id:paymentId,
            event_form_answers: eventFormAnswers
        }

        const result = await addSupabaseAttendee(insertData);
        
        res.status(201).json({
            message: 'Registration successful',
            attendee: result
        });

    } catch (error: any) {
        res.status(500).json({ error: error.message })
    }
})

eventRouter.post('/:eventId/register/guest', async (req, res) => {
    try {

        const {guestUser, attendee } = req.body;
        const eventId = req.params.eventId;

        const result = await registerGuestForEvent(guestUser, attendee, eventId);
        res.status(201).json({
            message: "Registration successful", 
            attendee:result
        });

    } catch (error: any) {
        res.status(500).json({ error: error.message })
    }
})

eventRouter.post('/:eventId/register/guest', async (req, res) => {
    try {

        const {guestUser, attendee } = req.body;
        const eventId = req.params.eventId;

        const result = await registerGuestForEvent(guestUser, attendee, eventId);
        res.status(201).json({
            message: "Registration successful", 
            attendee:result
        });

    } catch (error: any) {
        res.status(500).json({ error: error.message })
    }
})

eventRouter.post("/:id/attendees/isRegistered", async (req, res) => {
    const { id } = req.params
    const { email } = req.body
    try {
        const isRegistered = await checkIsRegistered(id, email);
        res.status(200).json({ message: "supabase is registered"})
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
})
