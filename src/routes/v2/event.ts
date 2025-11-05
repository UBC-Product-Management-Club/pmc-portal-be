import { Router, Request, Response } from "express";
import { getEvent, getEvents, getRegisteredEvents } from "../../services/Event/EventService";
import { Database } from "../../schema/v2/database.types";
import { addAttendee, getAttendee } from "../../services/Attendee/AttendeeService";
import { authenticated } from "../../middleware/Session";
import multer from "multer"
import { uploadSupabaseFiles } from "../../storage/Storage";


type AttendeeInsert = Database['public']['Tables']['Attendee']['Insert'];

export const eventRouter = Router()

const memStorage = multer.memoryStorage()
const upload = multer({ storage: memStorage })

eventRouter.get('/', ...authenticated, async (req, res) => {
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

eventRouter.get('/events/registered', ...authenticated, async (req, res) => {
    const user = req.user
    try {
        if (user) {
            const userCurrentEvents = await getRegisteredEvents(user.user_id);
            return res.status(200).json(userCurrentEvents);
        }
        return res.status(200).json([]);
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

eventRouter.get('/:eventId/attendee', ...authenticated, async (req: Request, res: Response) => {
    const userId = req.user?.user_id
    const eventId = req.params.eventId;

    if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
    }

    try {
        const attendee = await getAttendee(eventId, userId);
        return res.status(200).json(attendee);
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});


// Adds event attendee (payment not verified, payment id set to null)
eventRouter.post('/:eventId/register', ...authenticated, upload.any(), async (req: Request, res: Response) => {
    const userId = req.user?.user_id
    const eventId = req.params.eventId;

    if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
    }

    try {
        const files = req.files as Express.Multer.File[];
        const bucketName = process.env.SUPABASE_ATTENDEE_BUCKET_NAME!;
        const parentPath = `attendee/${eventId}/`;

        const fileRefs = await uploadSupabaseFiles(files, {parentPath, bucketName, isPublic: false}) 
        const eventFormAnswers = Object.assign(req.body, fileRefs);

        const insertData: AttendeeInsert = {
            user_id: userId,
            event_id: eventId,
            payment_id: null,
            is_payment_verified: false,
            event_form_answers: eventFormAnswers,
        };

        const result = await addAttendee(insertData);
        
        res.status(201).json({
            message: 'Registration successful',
            attendee: result
        });

    } catch (error: any) {
        console.error(error)
        res.status(500).json({ error: error.message })
    }
});