import { Request, Response, Router } from "express";
import { randomUUID } from "crypto";
import { z } from "zod/v4";
import { supabase } from "../../../config/supabase";
import { EventCreateSchema, EventUpdateSchema } from "../../../schema/v2/Event";
import { addEvent, createEventTeam, getEvent, getEventMedia, updateEvent, updateEventThumbnail } from "../../../services/Event/EventService";
import { uploadSupabaseFileList, getDeliverable, getEventDeliverables, deleteSupabaseFile, storagePathFromPublicUrl } from "../../../storage/Storage";
import multer from "multer";
import { formatGenericCSV } from "../../../services/User/utils";

const memStorage = multer.memoryStorage();
const upload = multer({ storage: memStorage });
export const eventRouter = Router();

eventRouter.get("/basic", async (req: Request, res: Response) => {
    const { data, error } = await supabase
        .from("Event")
        .select("event_id, name, thumbnail, date")
        .order("date", { ascending: false });

    if (error || !data) {
        console.error("Error fetching events: ", error);
        return res.status(500).json(error);
    }
    return res.status(200).json(data);
});

eventRouter.get("/:eventId", async (req: Request, res: Response) => {
    const eventId = req.params.eventId;

    if (!eventId) {
        return res.status(400).json({ error: "Event ID is required" });
    }

    try {
        const result = await getEvent(eventId);

        res.status(200).json(result);
    } catch (error: any) {
        console.error("Failed to fetch event:", error);
        res.status(500).json({ error: error.message });
    }
});

eventRouter.patch("/:eventId", async (req: Request, res: Response) => {
    const eventId = req.params.eventId;

    if (!eventId) {
        return res.status(400).json({ error: "Event ID is required" });
    }

    const result = EventUpdateSchema.safeParse(req.body);
    if (!result.success) {
        const flattened = z.flattenError(result.error);
        return res.status(400).json({
            error: "Validation failed",
            fieldErrors: flattened.fieldErrors,
            formErrors: flattened.formErrors,
        });
    }

    try {
        const updated = await updateEvent(eventId, result.data);
        if (!updated) {
            return res.status(404).json({ error: "Event not found" });
        }

        return res.status(200).json(updated);
    } catch (error: any) {
        console.error("Failed to update event:", error);
        return res.status(500).json({ error: error.message });
    }
});

// Best-effort removal of the image a new thumbnail replaced, so re-uploading doesn't
// leave a copy behind. Deliberately never throws: the event already points at the new
// image, so a failed delete is a stray file rather than a failed save.
const deleteReplacedThumbnail = async (
    previous: { thumbnail: string | null; media: string[] | null } | null,
    replacement: string,
    bucketName: string
) => {
    const old = previous?.thumbnail;
    if (!old || old === replacement) return;
    // Still on show in the event's gallery.
    if (previous?.media?.includes(old)) return;

    // Uploads live under `events/<eventId>/media/`, so a thumbnail in this bucket
    // can only belong to the event being edited.
    const path = storagePathFromPublicUrl(old, bucketName);
    if (!path) return;

    try {
        await deleteSupabaseFile(path, bucketName);
    } catch (error: any) {
        console.error(`Failed to delete replaced thumbnail ${path}:`, error.message);
    }
};

eventRouter.patch(
    "/:eventId/thumbnail",
    upload.single("thumbnail"),
    async (req: Request, res: Response) => {
        const eventId = req.params.eventId;

        if (!eventId) {
            return res.status(400).json({ error: "Event ID is required" });
        }

        const file = req.file;
        if (!file) {
            return res.status(400).json({ error: "Thumbnail file is required" });
        }

        try {
            const bucketName = process.env.SUPABASE_BUCKET_NAME!;
            const parentPath = `events/${eventId}/media/`;
            // Read the outgoing image before the row starts pointing at the new one.
            const previous = await getEventMedia(eventId);

            // uploadSupabaseFileList gives each upload a unique path, so the public URL
            // changes on every save and the CDN never serves a stale thumbnail.
            const [thumbnailUrl] = await uploadSupabaseFileList([file], {
                parentPath,
                bucketName,
                isPublic: true,
            });

            const updated = await updateEventThumbnail(eventId, thumbnailUrl);
            if (!updated) {
                return res.status(404).json({ error: "Event not found" });
            }

            await deleteReplacedThumbnail(previous, thumbnailUrl, bucketName);

            return res.status(200).json(updated);
        } catch (error: any) {
            console.error("Failed to update thumbnail:", error);
            return res.status(500).json({ error: error.message });
        }
    }
);

eventRouter.post(
    "/add",
    upload.fields([
        { name: "mediaFiles", maxCount: 5 },
        { name: "thumbnail", maxCount: 1 },
    ]),
    async (req: Request, res: Response) => {
        const result = EventCreateSchema.safeParse(req.body);
        if (!result.success) {
            const flattened = z.flattenError(result.error);
            return res.status(400).json({
                error: "Validation failed",
                fieldErrors: flattened.fieldErrors,
                formErrors: flattened.formErrors,
            });
        }

        const files = req.files as
            | {
                mediaFiles?: Express.Multer.File[];
                thumbnail?: Express.Multer.File[];
            }
            | undefined;
        const mediaFiles = files?.mediaFiles ?? [];
        const thumbnailFile = files?.thumbnail ?? [];

        const eventId = randomUUID();

        try {
            const bucketName = process.env.SUPABASE_BUCKET_NAME!;
            const parentPath = `events/${eventId}/media/`;

            const media = await uploadSupabaseFileList(mediaFiles, {
                parentPath,
                bucketName,
                isPublic: true,
            });
            const [thumbnail = null] = await uploadSupabaseFileList(thumbnailFile, {
                parentPath,
                bucketName,
                isPublic: true,
            });

            await addEvent({
                ...result.data,
                event_id: eventId,
                // Keep the denormalized `date` column on the event's start, as updateEvent does.
                date: result.data.start_time.slice(0, 10),
                media,
                thumbnail,
                is_disabled: false,
            });

            // NOTE: the numeric member_price/non_member_price columns are written, but
            // member_price_id/non_member_price_id are left null because nothing here talks
            // to Stripe yet. getEvent resolves display prices from those ids, so a new event
            // reads back as $0 and can't be checked out until the Stripe create path lands.
            const created = await getEvent(eventId);
            return res.status(201).json(created);
        } catch (error: any) {
            console.error("Failed to create event:", error);
            return res.status(500).json({ error: error.message });
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

eventRouter.get("/:eventId/deliverable/:userId/:phaseId", async (req: Request, res: Response) => {
    const userId = req.params.userId;
    const eventId = req.params.eventId;
    const phaseId = req.params.phaseId;

    if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
    }

    if (!eventId) {
        return res.status(400).json({ error: "Event ID is required" });
    }

    try {
        const result = await getDeliverable(userId, eventId, phaseId);

        res.status(200).json({
            message: "Deliverable fetched successfully",
            data: result,
        });
    } catch (error: any) {
        console.error("Fetch deliverable error:", error);
        res.status(500).json({ error: error.message });
    }
});

eventRouter.get("/:eventId/deliverables/export", async (req: Request, res: Response) => {
    const eventId = req.params.eventId;
    const format = (req.query.format as string) || "json";

    if (!eventId) {
        return res.status(400).json({ error: "Event ID is required" });
    }

    try {
        const deliverables = await getEventDeliverables(eventId);

        if (!deliverables || deliverables.length === 0) {
            return res.status(200).json({});
        }

        // Collect all phases and group by team
        const phases = new Set<string>();
        const byTeam: Record<string, { phases: Record<string, string>; lastSubmittedAt: string | null }> = {};

        for (const d of deliverables as any[]) {
            const teamName = d.Team?.team_name || "Unknown Team";
            const phase = d.phase_id || "unknown";
            const submission = d.submission as { file_links?: string[] } | null;
            const fileLinks = submission?.file_links || [];
            const submittedAt = d.submitted_at as string | null;

            phases.add(phase);

            if (!byTeam[teamName]) {
                byTeam[teamName] = { phases: {}, lastSubmittedAt: null };
            }

            byTeam[teamName].phases[phase] = fileLinks.join(", ");

            if (submittedAt && (!byTeam[teamName].lastSubmittedAt || submittedAt > byTeam[teamName].lastSubmittedAt)) {
                byTeam[teamName].lastSubmittedAt = submittedAt;
            }
        }

        const sortedPhases = Array.from(phases).sort();

        if (format === "csv") {
            const csvData = Object.entries(byTeam).map(([teamName, teamData]) => {
                const row: Record<string, string> = { team_name: teamName };
                for (const phase of sortedPhases) {
                    row[phase] = teamData.phases[phase] || "";
                }
                row["last_submitted_at"] = teamData.lastSubmittedAt || "";
                return row;
            });

            const csv = formatGenericCSV(csvData, ["team_name", ...sortedPhases, "last_submitted_at"]);

            res.setHeader("Content-Type", "text/csv");
            res.setHeader("Content-Disposition", `attachment; filename="event_${eventId}_deliverables.csv"`);
            return res.send(csv);
        }

        return res.status(200).json(byTeam);
    } catch (error: any) {
        console.error("Export deliverables error:", error);
        return res.status(500).json({ error: error.message });
    }
});
