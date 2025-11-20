import { Request, Response, Router } from "express";
import { uuidv4 } from "zod/v4";
import { supabase } from "../../../config/supabase";
import { EventSchema } from "../../../schema/v2/Event";
import { addEvent, createEventTeam } from "../../../services/Event/EventService";
import { uploadSupabaseFiles, getDeliverableDownloadUrls } from "../../../storage/Storage";
import multer from "multer";

const memStorage = multer.memoryStorage();
const upload = multer({ storage: memStorage });
export const eventRouter = Router();

eventRouter.get("/basic", async (req: Request, res: Response) => {
    const { data, error } = await supabase.from("Event").select("event_id, name");
    if (error || !data) {
        console.error("Error fetching events: ", error);
        return res.status(500).json(error);
    }
    return res.status(200).json(data);
});

//[WIP Needs to be retested]
eventRouter.post(
    "/add",
    upload.fields([
        { name: "mediaFiles", maxCount: 5 },
        { name: "thumbnail", maxCount: 1 },
    ]),
    async (req, res) => {
        const event_Id = uuidv4();

        // Unpacking request body
        try {
            const { name, date, start_time, end_time, description, location, member_price, non_member_price, member_only, max_attendees, event_form_questions, needs_review } = req.body;

            const files = req.files as {
                mediaFiles?: Express.Multer.File[];
                thumbnail?: Express.Multer.File[];
            };

            // Extracting files from FormData
            const mediaFiles = files.mediaFiles ?? [];
            const thumbnailFile = files.thumbnail ?? [];

            // Checking presence of required files
            const requiredFields = [name, date, location, description, mediaFiles, thumbnailFile, member_price, non_member_price, max_attendees, event_form_questions, needs_review];
            for (const field of requiredFields) {
                if (!field || (field === mediaFiles && mediaFiles.length === 0)) {
                    return res.status(400).json({
                        message: "Invalid Event. Required fields are missing",
                    });
                }
            }

            // Checking if member_only is undefined
            if (member_only === undefined) {
                return res.status(400).json({ message: "member_only is required" });
            }

            // Constructing proper time fields
            const startTimestamp = `${date}T${start_time}`;
            const endTimestamp = `${date}T${end_time}`;

            // Upload files to get download url
            const bucketName = process.env.SUPABASE_BUCKET_NAME!;
            const parentPath = `events/${event_Id}/media/`;
            const mediaData = await uploadSupabaseFiles(mediaFiles, { parentPath, bucketName, isPublic: true });
            const thumbnailData = await uploadSupabaseFiles(thumbnailFile, { parentPath, bucketName, isPublic: true });

            // Convert object into expected type
            const media = Object.values(mediaData);
            const thumbnail = Object.values(thumbnailData)[0]; // Guaranteed to have one element

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
                needs_review: needs_review,
            };

            const result = EventSchema.safeParse(event);
            if (!result.success) {
                throw new Error(result.error.message);
            }

            await addEvent(result.data);
            res.status(201).json({
                message: `Supabase Event with ID ${event_Id} has been added successfully.`,
            });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }
);

eventRouter.post("/:eventId/team", async (req: Request, res: Response) => {
    const eventId = req.params.eventId;
    const { team_name, team_attendee_ids } = req.body;
    if (!team_name || !Array.isArray(team_attendee_ids) || team_attendee_ids.length === 0) {
        return res.status(400).json({ error: "Invalid request body" });
    }

    try {
        const team = await createEventTeam(eventId, team_name, team_attendee_ids);
        return res.status(201).json({ success: true, team });
    } catch (error: any) {
        console.error(error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

eventRouter.get("/:eventId/deliverable/:userId", async (req: Request, res: Response) => {
    const userId = req.params.userId;
    const eventId = req.params.eventId;

    if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
    }

    if (!eventId) {
        return res.status(400).json({ error: "Event ID is required" });
    }

    try {
        const result = await getDeliverableDownloadUrls(userId, eventId);

        res.status(200).json({
            message: "Deliverable fetched successfully",
            data: result,
        });
    } catch (error: any) {
        console.error("Fetch deliverable error:", error);
        res.status(500).json({ error: error.message });
    }
});
