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
        const filePath = `${parentPath}${file.fieldname}-${safeName}`;

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

export const uploadDeliverableFiles = async (files: Express.Multer.File[], userId: string, eventId: string, formData: unknown) => {
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

    const { data: parent, error: upsertError } = await supabase
        .from("Deliverable")
        .upsert([{ event_id: eventId, team_id: teamId }], { onConflict: "event_id,team_id" })
        .select("deliverable_id")
        .single();

    if (upsertError || !parent) {
        throw new Error("Failed to upsert parent");
    }
    const deliverableId = parent.deliverable_id;

    const bucketName = process.env.SUPABASE_DELIVERABLES_BUCKET!;
    const version_id = crypto.randomUUID();
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, "-");
    const parentPath = `events/${eventId}/teams/${teamId}/deliverables/${timestamp}-${teamId}/`;
    const uploadedFiles = await uploadSupabaseFiles(files, {
        parentPath,
        bucketName,
        isPublic: true,
    });

    const filePaths = Object.values(uploadedFiles);
    const submissionWithLinks = {
        ...(formData as object),
        file_links: filePaths,
    };
    const { data: version, error: versionError } = await supabase
        .from("Deliverable_Version")
        .insert({
            version_id: version_id,
            deliverable_id: deliverableId,
            submitted_at: now.toISOString(),
            submitted_by: userId,
            submission: submissionWithLinks,
        })
        .select("submission")
        .single();

    const file_links = version!.submission as { file_links: string[] };

    if (versionError || !version) {
        throw versionError;
    }

    await supabase.from("Deliverable").update({ version_id: version_id }).eq("deliverable_id", deliverableId);

    return {
        deliverableId,
        version_id,
        file_links,
    };
};

export const getDeliverable = async (userId: string, eventId: string): Promise<unknown> => {
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

    const { data: deliverable, error: deliverableError } = await supabase.from("Deliverable").select("version_id").eq("team_id", teamId).single();
    if (deliverableError || !deliverable) {
        throw new Error("Deliverable not found");
    }
    const versionId = deliverable.version_id;

    const { data: version, error: versionError } = await supabase.from("Deliverable_Version").select("*").eq("version_id", versionId!).single();
    if (versionError || !version) {
        throw new Error("Deliverable version not found");
    }

    return version;
};
