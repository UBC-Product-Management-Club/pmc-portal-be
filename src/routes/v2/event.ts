import { Router } from "express";
import { getEvent, getEvents, getRegisteredEvents } from "../../services/Event/EventService";
import { Database } from "../../schema/v2/database.types";
import { addAttendee } from "../../services/Attendee/AttendeeService";

type AttendeeInsert = Database['public']['Tables']['Attendee']['Insert'];

export const eventRouter = Router()

eventRouter.get('/', async (req, res) => {
    try {
        const events = await getEvents();
        res.status(200).json(events);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

eventRouter.get('/:id', async (req, res) => {
    try {
        const eventByID = await getEvent(req.params.id);
        res.status(200).json(eventByID);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

eventRouter.get('/user-events/:userId', async (req, res) => {
    try {
        const userCurrentEvents = await getRegisteredEvents(req.params.userId);
        res.status(200).json(userCurrentEvents);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Adds attendee (payment not verified, payment id set to null)
eventRouter.post('/:eventId/register/member', async (req, res) => {
    try {
        const userId = req.body.userId;
        const eventId = req.params.eventId;
        const eventFormAnswers = req.body.eventFormAnswers;
        
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const insertData: AttendeeInsert = {
            user_id: userId,
            event_id:eventId,
            payment_id:null,
            event_form_answers: eventFormAnswers
        }

        const result = await addAttendee(insertData);
        
        res.status(201).json({
            message: 'Registration successful',
            attendee: result
        });

    } catch (error: any) {
        res.status(500).json({ error: error.message })
    }
});