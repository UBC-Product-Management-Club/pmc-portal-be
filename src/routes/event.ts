import {Router} from "express";
import {addEvent, getEventById, getEvents, uploadEventMedia} from "../controllers/events/event";
import { Attendee, Event } from "../schema/Event"
import { v4 as uuidv4 } from 'uuid';
import multer from "multer"
import { addAttendee } from "../controllers/events/attendee";
import { addTransaction } from "../controllers/payments/add";
import { addTransactionBody } from "../schema/Transaction";

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

eventRouter.post('/registered', async (req, res) => {
    try {
        const { attendeeInfo, paymentInfo } : {
            attendeeInfo: Attendee,
            paymentInfo: addTransactionBody
        } = req.body
        addAttendee(attendeeInfo) // should add attendee to firestore
        addTransaction(paymentInfo) // should add transaction to firestore
        res.status(200).json({
            message: "registration successful"
        })
    } catch (error: any) {
        res.status(500).json({ error: error.message })
    }


})

eventRouter.post('/addEvent', upload.array('media', 5), async (req, res) => {
    const event_Id = uuidv4(); // generate a unique event ID -- do i need this or does firestore does it for me?
    const { name,
        date,
        description,
        location,
        member_price,
        non_member_price,
        member_only,
        attendee_Ids,
        maxAttendee,
        eventForm
    } = JSON.parse(JSON.stringify(req.body))
    const mediaFiles = req.files as Express.Multer.File[]

    const requiredFields = [name, date, location, description, mediaFiles, member_price, non_member_price, attendee_Ids, maxAttendee];
    const checkUndefinedFields = [member_only];

    // Check for missing required fields or empty `mediaFiles`
    for (const field of requiredFields) {
        if (!field || (field === mediaFiles && mediaFiles.length === 0)) {
            return res.status(400).json({
                message: "Invalid Event. Required fields are missing"
            });
        }
    }


    // Check if `member_only` is undefined
    for (const field of checkUndefinedFields) {
        if (field === undefined) {
            return res.status(400).json({
                message: "Invalid Event. Required fields are missing"
            });
        }
    }
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
            attendee_Ids: JSON.parse(attendee_Ids as string),
            maxAttendee: parseInt(maxAttendee as string) as number,
            eventForm: JSON.parse(eventForm as string),
            isDisabled: false
        }
        await addEvent(event_Id, event);
        res.status(201).json({
            message: `Event with ID ${event_Id} has been added successfully.`,
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});
