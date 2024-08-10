import { Router } from "express";
import { getEvents, getEventById, addEvent, uploadEventMedia } from "../controllers/events/event";
import { Event } from "../schema/Event"
import { v4 as uuidv4 } from 'uuid';
import multer from "multer"

export const eventRouter = Router()

const memStorage = multer.memoryStorage()
const upload = multer({storage: memStorage})

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

eventRouter.post('/addEvent', upload.array('media', 5), async (req, res) => {
    const event_Id = uuidv4(); // generate a unique event ID -- do i need this or does firestore does it for me?
    const { name,
            date,
            description,
            location,
            member_price,
            non_member_price,
            member_only,
            attendee_Ids
    } = JSON.parse(JSON.stringify(req.body)) 
    const mediaFiles = req.files as Express.Multer.File[]

    // can replace with below so missing values are coerced to undefined and throws an error when uploading to firestore.
    const eventDetails = { event_Id, name, date, description, location, member_price, non_member_price, member_only, attendee_Ids } 

    // this doesn't work??? The error is caught later on but this should work. Might have to check each field manually...
    // if (Object.values(eventDetails).every((x) => x)) {
    //     return res.status(400).json({
    //         message: "Invalid Event. Required fields are missing"
    //     })
    // }


    try {
        const media = await uploadEventMedia(event_Id, mediaFiles) // upload media and get download links
        const event: Event = {media,...eventDetails}
        await addEvent(event_Id, event);
        res.status(201).json({
             message: `Event with ID ${event_Id} has been added successfully.`,
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});
