import { supabase } from "../config/supabase";

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

export const uploadDeliverableFiles = async (files: Express.Multer.File[], userId: string, eventId: string, phaseId: string, formData: unknown) => {
    const { data: attendee, error: attendeeError } = await supabase.from("Attendee").select("attendee_id").eq("user_id", userId).eq("event_id", eventId).single();

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
        const uploadedFiles = await uploadSupabaseFiles(files, {
            parentPath,
            bucketName,
            isPublic: true,
        });
        filePaths = Object.values(uploadedFiles);
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

export const getDeliverable = async (userId: string, eventId: string, phaseId: string): Promise<unknown> => {
    const { data: attendee, error: attendeeError } = await supabase.from("Attendee").select("attendee_id").eq("user_id", userId).eq("event_id", eventId).single();
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
