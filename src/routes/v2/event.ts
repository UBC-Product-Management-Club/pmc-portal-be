import { Router } from "express";
import { addEvent, getSupabaseEventById, getSupabaseEvents } from "../../services/events/event";
import { Attendee, FirebaseEvent } from "../../schema/v1/FirebaseEvent"
import { v4 as uuidv4 } from 'uuid';
import multer from "multer"
import { addAttendee, addSupabaseAttendee, getAttendeeById } from "../../services/events/attendee";
import { addTransaction } from "../../services/payments/add";
import { addTransactionBody } from "../../schema/v1/Transaction";
import { sendEmail } from "../../services/emails/send";
import { checkIsRegistered } from "../../services/events/attendee";
import { uploadFiles } from "../../utils/files";
import { Database } from "../../schema/v2/database.types";


type AttendeeInsert = Database['public']['Tables']['Attendee']['Insert'];

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

eventRouter.post('/:eventId/register', async (req, res) => {
    try {
        const userId = req.body.userId;
        const paymentId = req.body.paymentId;
        const eventId = req.params.eventId;
        const eventFormAnswers = req.body.eventFormAnswers;
        
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const result = await addSupabaseAttendee({
            userId,
            eventId,
            paymentId,
            eventFormAnswers
        });
        
        res.status(201).json({
            message: 'Registration successful',
            attendee: result
        });

    } catch (error: any) {
        res.status(500).json({ error: error.message })
    }
})

eventRouter.post('/addEvent', upload.array('media', 5), async (req, res) => {
    // const event_Id = uuidv4(); // generate a unique event ID -- do i need this or does firestore does it for me?
    // const {
    //     name,
    //     date,
    //     start_time,
    //     end_time,
    //     description,
    //     location,
    //     member_price,
    //     non_member_price,
    //     member_only,
    //     attendee_Ids,
    //     maxAttendee,
    //     eventFormId
    // } = JSON.parse(JSON.stringify(req.body))
    // const mediaFiles = req.files as Express.Multer.File[]

    // const requiredFields = [name, date, location, description, mediaFiles, member_price, non_member_price, attendee_Ids, maxAttendee];
    // const checkUndefinedFields = [member_only];

    // // Check for missing required fields or empty `mediaFiles`
    // for (const field of requiredFields) {
    //     if (!field || (field === mediaFiles && mediaFiles.length === 0)) {
    //         return res.status(400).json({
    //             message: "Invalid Event. Required fields are missing"
    //         });
    //     }
    // }


    // // Check if `member_only` is undefined
    // for (const field of checkUndefinedFields) {
    //     if (field === undefined) {
    //         return res.status(400).json({
    //             message: "Invalid Event. Required fields are missing"
    //         });
    //     }
    // }
    try {
    //     const parentPath = `events/${event_Id}/media/`
    //     const media = await uploadFiles(mediaFiles, parentPath) // upload media and get download links
    //     const event: Event = {
    //         event_Id,
    //         name,
    //         date,
    //         start_time,
    //         end_time,
    //         description,
    //         location,
    //         media,
    //         member_price: parseInt(member_price as string) as number,
    //         non_member_price: parseInt(non_member_price as string) as number,
    //         member_only: Boolean(JSON.parse(member_only as string)),
    //         attendee_Ids: JSON.parse(attendee_Ids as string),
    //         maxAttendee: parseInt(maxAttendee as string) as number,
    //         eventFormId: JSON.parse(eventFormId as string),
    //         isDisabled: false,
    //         points: {}
    //     }
    //     await addEvent(event_Id, event);
        res.status(201).json({
            message: `supabase event added successfully`,
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
