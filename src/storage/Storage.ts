import { supabase } from "../config/supabase";
import { AttendeeRepository } from "./AttendeeRepository";

type UploadOptions = {
    parentPath: string;
    bucketName: string;
    isPublic: boolean;
};

const sanitizeFileName = (name: string) =>
    name
        .normalize("NFKD")
        .replace(/[^\w.-]+/g, "_")
        .replace(/_+/g, "_");

export const uploadSupabaseFiles = async (files: Express.Multer.File[], { parentPath, bucketName, isPublic }: UploadOptions): Promise<Record<string, string>> => {
    const result: Record<string, string> = {};

    for (const file of files) {
        const safeName = sanitizeFileName(file.originalname);
        const filePath = `${parentPath}${safeName}`;

        // upload file to Supabase bucket
        const { data: uploadData, error: uploadError } = await supabase.storage.from(bucketName).upload(filePath, file.buffer, {
            upsert: true,
            contentType: file.mimetype || "application/octet-stream",
        });
        if (uploadError) {
            throw uploadError;
        }

        if (isPublic) {
            const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(uploadData.path);
            result[file.fieldname] = publicUrlData.publicUrl;
        } else {
            result[file.fieldname] = filePath;
        }
    }
    return result;
};

// Public object URLs are built as `<project>/storage/v1/object/public/<bucket>/<path>`.
// Deriving the prefix from getPublicUrl means it always matches however the stored
// URLs were encoded.
const publicUrlPrefix = (bucketName: string) => supabase.storage.from(bucketName).getPublicUrl("").data.publicUrl;

export const storagePathFromPublicUrl = (url: string, bucketName: string): string | null => {
    const prefix = publicUrlPrefix(bucketName);
    if (!url.startsWith(prefix)) {
        return null;
    }

    const path = url.slice(prefix.length);
    if (!path) {
        return null;
    }

    try {
        return decodeURIComponent(path);
    } catch {
        return null;
    }
};

export const deleteSupabaseFile = async (path: string, bucketName: string) => {
    const { error } = await supabase.storage.from(bucketName).remove([path]);
    if (error) {
        throw error;
    }
};

export const getEventDeliverables = async (eventId: string) => {
    const { data: deliverables, error } = await supabase
        .from("Deliverable")
        .select(
            `
            deliverable_id,
            phase_id,
            submission,
            submitted_at,
            Team!inner (
                team_id,
                team_name
            )
        `
        )
        .eq("event_id", eventId);

    if (error) {
        throw new Error(error.message);
    }

    return deliverables;
};

export const getDeliverable = async (userId: string, eventId: string, phaseId: string): Promise<unknown> => {
    const { data: attendee, error: attendeeError } = await AttendeeRepository.getAttendee(eventId, userId);
    if (attendeeError || !attendee) {
        throw new Error("User is not registered as an attendee for this event");
    }
    const attendeeId = attendee.attendee_id;

    const { data: teamMember, error: teamError } = await supabase.from("Team_Member").select("team_id").eq("attendee_id", attendeeId).single();
    if (teamError || !teamMember) {
        throw new Error("User is not part of any team for this event");
    }
    const teamId = teamMember.team_id;

    const { data: deliverable } = await supabase
        .from("Deliverable")
        .select(
            `
      submission,
      submitted_at,
      User:submitted_by (
        first_name,
        last_name
      )
    `
        )
        .eq("team_id", teamId)
        .eq("event_id", eventId)
        .eq("phase_id", phaseId)
        .maybeSingle();

    return deliverable;
};
