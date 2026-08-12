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

// Uploads every file and returns their public URLs (or storage paths, when private)
// in the same order as `files`. Each upload gets a unique name, so two files sharing
// an original filename can't overwrite each other, and a replaced image always gets a
// fresh URL rather than one the CDN may still be serving stale.
export const uploadSupabaseFileList = async (files: Express.Multer.File[], { parentPath, bucketName, isPublic }: UploadOptions): Promise<string[]> => {
    const result: string[] = [];
    const stamp = Date.now();

    for (const [index, file] of files.entries()) {
        const safeName = sanitizeFileName(file.originalname);
        const filePath = `${parentPath}${stamp}-${index}-${safeName}`;

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
            result.push(publicUrlData.publicUrl);
        } else {
            result.push(filePath);
        }
    }
    return result;
};

// The same uploads, keyed by the form field each file arrived in. Only meaningful when
// every file has its own field name — an attendee form, where each question carries one
// upload. Files sharing a field name collapse onto a single key, so anything with a
// multi-file field must use `uploadSupabaseFileList` instead.
export const uploadSupabaseFiles = async (files: Express.Multer.File[], options: UploadOptions): Promise<Record<string, string>> => {
    const uploaded = await uploadSupabaseFileList(files, options);

    const result: Record<string, string> = {};
    files.forEach((file, index) => {
        result[file.fieldname] = uploaded[index];
    });
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

export const uploadDeliverableFiles = async (files: Express.Multer.File[], userId: string, eventId: string, phaseId: string, formData: unknown) => {
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

    const now = new Date();

    // Only upload files if there are any
    let filePaths: string[] = [];
    if (files.length > 0) {
        const bucketName = process.env.SUPABASE_DELIVERABLES_BUCKET!;
        const parentPath = `events/${eventId}/teams/${teamId}/${phaseId}/`;
        filePaths = await uploadSupabaseFileList(files, {
            parentPath,
            bucketName,
            isPublic: true,
        });
    }

    const submission = {
        ...(formData as object),
        ...(filePaths.length > 0 && { file_links: filePaths }),
    };

    const { data: deliverable, error: upsertError } = await supabase
        .from("Deliverable")
        .upsert(
            [
                {
                    event_id: eventId,
                    team_id: teamId,
                    phase_id: phaseId,
                    submission,
                    submitted_at: now.toISOString(),
                    submitted_by: userId,
                },
            ],
            { onConflict: "event_id,team_id,phase_id" }
        )
        .select("deliverable_id, submission")
        .single();

    if (upsertError || !deliverable) {
        throw new Error("Failed to save deliverable");
    }

    const file_links = deliverable.submission as { file_links: string[] };

    return {
        deliverableId: deliverable.deliverable_id,
        file_links,
    };
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
