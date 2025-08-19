import { Request, Response, Router } from "express";
import { EventSchema, EventInsert } from "../../schema/v2/Event";
import { uploadSupabaseFiles } from "../../utils/files";
import { v4 as uuidv4 } from 'uuid';
import multer from "multer"
import { exportUsers, getUser, getUsers } from "../../services/User/UserService";
import { addEvent } from "../../services/events/EventService";

export const adminRouter = Router();

const memStorage = multer.memoryStorage()
const upload = multer({ storage: memStorage })

adminRouter.get("/users", async (req: Request, res: Response) => {
    try {
        const users = await getUsers();
        return res.status(200).send(users);
    } catch (error) {
        console.error(error);
        return res.status(500).send(error);
    }
});

adminRouter.get("/users/export", async (req: Request, res: Response) => {
    try {
        const password = req.query.password as string;

        if (!password) {
            return res.status(401).send({ error: "Password is required" });
        }

        const isCSV = req.query.csv === "true";
        const users = await exportUsers(password, isCSV);

        if (isCSV) {
            res.setHeader("Content-Type", "text/csv");
            res.setHeader("Content-Disposition", "attachment; filename=users.csv");
            return res.status(200).send(users);
        }

        res.setHeader("Content-Type", "application/json");
        res.setHeader("Content-Disposition", "attachment; filename=users.json");
        return res.status(200).json(users);
    } catch (error: any) {
        console.error(error);
        if (error.message === "Invalid password") {
            return res.status(401).send({ error: "Invalid password" });
        }
        return res.status(500).send({ error: "Failed to export users" });
    }
});

adminRouter.get("/users/:id", async (req: Request, res: Response) => {
    try {
        const user = await getUser(req.params.id);
        if (user) {
            return res.status(200).json(user);
        } else {
            return res.status(404).json({ error: "User not found" });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Failed to get user" });
    }
});

adminRouter.post('/events/add', upload.fields([{ name: 'mediaFiles', maxCount: 5 },{ name: 'thumbnail', maxCount: 1 }]), async (req, res) => {
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
            needs_review
        } = req.body;

        const files = req.files as {
            mediaFiles?: Express.Multer.File[],
            thumbnail?: Express.Multer.File[]
        };

        // Extracting files from FormData
        const mediaFiles = files.mediaFiles ?? [];
        const thumbnailFile = files.thumbnail ?? [];

        // Checking presence of required files
        const requiredFields = [name, date, location, description, mediaFiles, thumbnailFile, member_price, non_member_price, max_attendees, event_form_questions, needs_review];
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
            needs_review: needs_review
        };

        const result = EventSchema.safeParse(event);
        if (!result.success) {
            throw new Error(result.error.message);
        };

        await addEvent(result.data)
        res.status(201).json({
            message: `Supabase Event with ID ${event_Id} has been added successfully.`,
        });

    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});