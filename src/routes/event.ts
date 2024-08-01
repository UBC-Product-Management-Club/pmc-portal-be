import { Router } from "express";
import { getEvents, getEventById, addEvent, uploadEventMedia } from "../controllers/events/event";
import { Event } from "../schema/Event"
import { v4 as uuidv4 } from 'uuid';
import multer from "multer"

export const eventRouter = Router()

const memStorage = multer.memoryStorage()
const upload = multer({ storage: memStorage })

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
<<<<<<< HEAD
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

    // need placeholders in frontend to request user input for these?
    if (!name || !date || !location || !description || !mediaFiles || !member_price || !non_member_price || !attendee_Ids || member_only == undefined || mediaFiles.length == 0) {
        return res.status(400).json({
            message: "Invalid Event. Required fields are missing"
        })
    }

=======
    const { name, date, location, description, media, member_price, non_member_price, attendees, member_only } = req.body;

    // need placeholders in frontend to request user input for these?
    if (!name || !date || !location || !description || !media || !member_price || !non_member_price || !attendees || !member_only) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const newEvent: Event = { event_Id, name, date, location, description, media, member_price, non_member_price, attendees, member_only };
>>>>>>> 972a131 (updated the minor changes)

    try {
        const media = await uploadEventMedia(event_Id, mediaFiles) // upload media and get download links
        const event: Event = {
            event_Id,
            name,
            date,
            description,
            location,
            media,
            member_price: parseInt(member_price as string) as number,
            non_member_price: parseInt(non_member_price as string) as number,
            member_only: Boolean(JSON.parse(member_only as string)),
            attendee_Ids: JSON.parse(attendee_Ids as string)
        }
        await addEvent(event_Id, event);
        res.status(201).json({
            message: `Event with ID ${event_Id} has been added successfully.`,
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});
