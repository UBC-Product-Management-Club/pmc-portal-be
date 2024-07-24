import { Router } from "express";
import { getAttendees, getAttendeeById, addAttendee } from "../controllers/events/attendee";
import { Attendee } from "../controllers/events/types"
import { v4 as uuidv4 } from 'uuid';


export const attendeeRouter = Router()

attendeeRouter.get('/', async (req, res) => {
    try {
        const attendee = await getAttendees();
        res.status(200).json(attendee);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

attendeeRouter.get('/:id', async (req, res) => {
    try {
        const attendeeById = await getAttendeeById(req.params.id);
        res.status(200).json(attendeeById);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

attendeeRouter.post('/addAttendee', async (req, res) => {
    const attendee_Id = uuidv4(); // might create a new field in the collection
    const { is_member, member_Id, event_Id } = req.body;

    // need to figure how to pass in event ID and member ID dynamically? 
    // so when users click register, it sends their current member ID (through session) and the event ID it clicked
    if (!is_member || !member_Id || !event_Id) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const newAttendee: Attendee = { attendee_Id, is_member, member_Id, event_Id };

    try {
        await addAttendee(attendee_Id, newAttendee);
        res.status(201).json({ message: `Attendee with ID ${attendee_Id} has been created successfully.` });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});