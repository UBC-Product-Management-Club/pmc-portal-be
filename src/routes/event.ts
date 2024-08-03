import { Router } from "express";
import { getEvents, getEventById, addEvent } from "../controllers/events/event";
import { Event } from "../controllers/events/types"
import { v4 as uuidv4 } from 'uuid';

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
        const eventByID = await getEventById(req.params.id);
        res.status(200).json(eventByID);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

eventRouter.post('/addEvent', async (req, res) => {
    const event_Id = uuidv4(); // generate a unique event ID -- do i need this or does firestore does it for me?
    const { name, date, location, description, media, member_price, non_member_price, attendees, member_only } = req.body;

    // need placeholders in frontend to request user input for these?
    if (!name || !date || !location || !description || !media || !member_price || !non_member_price || !attendees || member_only == undefined) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const newEvent: Event = { event_Id, name, date, location, description, media, member_price, non_member_price, attendees, member_only };

    try {
        await addEvent(event_Id, newEvent);
        res.status(201).json({ message: `Event with ID ${event_Id} has been added successfully.` });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});
