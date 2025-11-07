import { Router, Request, Response } from "express";
import { getEvent, getEvents, getRegisteredEvents } from "../../services/Event/EventService";
import { Database } from "../../schema/v2/database.types";
import { addAttendee, getAttendee } from "../../services/Attendee/AttendeeService";
import { authenticated } from "../../middleware/Session";
import { DraftService } from "../../services/Drafts/DraftService";
import multer from "multer"
import { uploadSupabaseFiles } from "../../storage/Storage";
import { LoopsEvent, sendEmail } from "../../services/Email/EmailService";


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
    const userId = req.user?.user_id
    if (!userId) return res.status(400).json({ error: "User ID is required!"})

    try {
        const userCurrentEvents = await getRegisteredEvents(userId);
        return res.status(200).json(userCurrentEvents);
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

eventRouter.get('/:eventId/attendee', ...authenticated, async (req: Request, res: Response) => {
    const userId = req.user?.user_id
    const eventId = req.params.eventId;
    if (!userId) return res.status(400).json({ error: "User ID required!"})
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
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });


    try {
        const event = await getEvent(eventId)

        if (!event) {
            throw new Error(`Failed to fetch event ${eventId}`)
        }

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

        const result = await addAttendee(event, insertData);
        sendEmail(userId, LoopsEvent.ApplicationReceived, { event_name: event.name! })
        res.status(201).json({
            message: 'Registration successful',
            attendee: result
        });

    } catch (error: any) {
<<<<<<< HEAD
        console.error("Error during registration:", error);
        res.status(500).json({ error: error.message })
=======
        console.error(error)
        res.status(500).json(error)
>>>>>>> origin/main
    }
});

eventRouter.get('/drafts/:eventId', ...authenticated, async (req, res) => {
    try {
        const { eventId } = req.params;
        const { userId } = req.query;

        if (!userId || typeof userId !== 'string') {
            return res.status(400).json({ error: 'userId is required' });
        }

        const draftService = new DraftService();
        const draft = await draftService.loadDraft(eventId, userId);
        
        res.status(200).json(draft);
    } catch (error: any) {
        console.error('Error loading draft:', error);
        res.status(500).json({ error: error.message });
    }
});

eventRouter.post('/drafts/:eventId', ...authenticated, async (req, res) => {
    try {
        const { eventId } = req.params;
        const { userId, draft } = req.body;

        if (!userId || !draft) {
            return res.status(400).json({ error: 'userId and draft are required' });
        }

        const draftService = new DraftService();
        const savedDraft = await draftService.saveDraft(eventId, userId, draft);
        
        res.status(200).json(savedDraft);
    } catch (error: any) {
        console.error('Error saving draft:', error);
        res.status(500).json({ error: error.message });
    }
});

eventRouter.delete('/drafts/:eventId', ...authenticated, async (req, res) => {
    try {
        const { eventId } = req.params;
        const { userId } = req.query;

        if (!userId || typeof userId !== 'string') {
            return res.status(400).json({ error: 'userId is required' });
        }

        const draftService = new DraftService();
        await draftService.deleteDraft(eventId, userId);
        
        res.status(204).send();
    } catch (error: any) {
        console.error('Error deleting draft:', error);
        res.status(500).json({ error: error.message });
    }
});
