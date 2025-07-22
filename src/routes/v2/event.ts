import { Router } from "express";
import { getSupabaseEventById, getSupabaseEvents, addSupabaseEvent } from "../../services/events/event";
import { Attendee, FirebaseEvent } from "../../schema/v1/FirebaseEvent"
import { v4 as uuidv4 } from 'uuid';
import multer from "multer"
import { addAttendee, addSupabaseAttendee, getAttendeeById, registerGuestForEvent } from "../../services/events/attendee";
import { addTransaction } from "../../services/payments/add";
import { addTransactionBody } from "../../schema/v1/Transaction";
import { sendEmail } from "../../services/emails/send";
import { checkIsRegistered } from "../../services/events/attendee";
import { uploadFiles, uploadSupabaseFiles } from "../../utils/files";
import { Database } from "../../schema/v2/database.types";
import { EventSchema, EventInsert } from "../../schema/v2/Event";


type AttendeeInsert = Database['public']['Tables']['Attendee']['Insert'];
type UserInsert = Database['public']['Tables']['User']['Insert'];

export const eventRouter = Router()

const memStorage = multer.memoryStorage()
const upload = multer({ storage: memStorage })

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

eventRouter.post('/addEvent', upload.fields([{ name: 'mediaFiles', maxCount: 5 },{ name: 'thumbnail', maxCount: 1 }]), async (req, res) => {
    const event_Id = uuidv4();

    // Unpacking request body
    try {
        const {
            name,
            date,
            start_time,
            end_time,
            description,
            location,
            member_price,
            non_member_price,
            member_only,
            max_attendees,
            event_form_questions,
        } = req.body;

        const files = req.files as {
            mediaFiles?: Express.Multer.File[],
            thumbnail?: Express.Multer.File[]
        };

        // Extracting files from FormData
        const mediaFiles = files.mediaFiles ?? [];
        const thumbnailFile = files.thumbnail ?? [];

        // Checking presence of required files
        const requiredFields = [name, date, location, description, mediaFiles, thumbnailFile, member_price, non_member_price, max_attendees, event_form_questions];
        for (const field of requiredFields) {
            if (!field || (field === mediaFiles && mediaFiles.length === 0)) {
                return res.status(400).json({
                    message: "Invalid Event. Required fields are missing"
                });
            }
        }

        // Checking if member_only is undefined
        if (member_only === undefined) {
            return res.status(400).json({ message: "member_only is required" });
        }

        // Constructing proper time fields
        const startTimestamp = `${date}T${start_time}`; // → e.g. "2025-07-18T17:00:00"
        const endTimestamp = `${date}T${end_time}`;

        // Upload files to get download url
        const parentPath = `events/${event_Id}/media/`
        const media = await uploadSupabaseFiles(mediaFiles, parentPath) 
        const thumbnail = await uploadSupabaseFiles(thumbnailFile, parentPath) // Guaranteed to be an one element array

        // Creates event object for insertion
        const event = {
            event_id: event_Id,
            name: name,
            date: date, 
            start_time: startTimestamp,
            end_time: endTimestamp,
            description: description,
            location: location,
            member_price: member_price,
            non_member_price: non_member_price,
            max_attendees: max_attendees,
            event_form_questions: event_form_questions, 
            is_disabled: false,
            media: media,
            thumbnail: thumbnail[0], 
        };

        const result = EventSchema.safeParse(event);
        if (!result.success) {
            throw new Error(result.error.message);
        };

        const parsedEvent: EventInsert = result.data;

        await addSupabaseEvent(parsedEvent) // TODO make addSupabaseEvent function
        res.status(201).json({
            message: `Supabase Event with ID ${event_Id} has been added successfully.`,
        });

    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

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
