import type { Database } from '../../schema/v2/database.types';
import { Router } from "express";
import { getSupabaseEventById, getSupabaseEvents, addSupabaseEvent } from "../../services/events/event";
import { Attendee, FirebaseEvent } from "../../schema/v1/FirebaseEvent"
import { v4 as uuidv4 } from 'uuid';
import multer from "multer"
import { addAttendee, getAttendeeById } from "../../services/events/attendee";
import { addTransaction } from "../../services/payments/add";
import { addTransactionBody } from "../../schema/v1/Transaction";
import { sendEmail } from "../../services/emails/send";
import { checkIsRegistered } from "../../services/events/attendee";
import { uploadFiles, uploadSupabaseFiles } from "../../utils/files";

export const eventRouter = Router()

type EventInsert = Database['public']['Tables']['Event']['Insert'];
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

eventRouter.post('/:id/registered', upload.array('files', 5), async (req, res) => {
    try {
        // const attendeeInfo = JSON.parse(req.body.attendeeInfo) as Attendee
        // const paymentInfo = JSON.parse(req.body.paymentInfo) as addTransactionBody

        // const files = req.files as Express.Multer.File[]

        // if (files && files.length > 0) {
        //     const parentPath = `events/${req.params.id}/attendees/${attendeeInfo.attendee_Id}/files/`
        //     const uploadedFiles = await uploadFiles(files, parentPath)
        //     attendeeInfo.files = uploadedFiles
        // }

        // const attendee = {
        //     ...attendeeInfo,
        //     points: 1,
        //     activities_attended: []
        // }

        // await addSupabaseAttendee(attendee) // should add attendee to firestore
        // await addSupabaseTransaction(paymentInfo) // should add transaction to firestore
        // await sendEmail(attendeeInfo)
        res.status(200).json({
            message: "supabase registration successful"
        })
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
        const event: EventInsert = {
            event_id: event_Id,
            name: name as string,
            date: date as string, 
            start_time: startTimestamp as string,
            end_time: endTimestamp as string,
            description: description as string,
            location: location as string,
            member_price: parseInt(member_price as string) as number,
            non_member_price: parseInt(non_member_price as string) as number,
            max_attendees: parseInt(max_attendees as string) as number,
            event_form_questions: JSON.parse(event_form_questions) as any, // TODO define stricter type
            is_disabled: false,
            media: media as string[],
            thumbnail: thumbnail[0] as string, 
        };
        await addSupabaseEvent(event) // TODO make addSupabaseEvent function
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
