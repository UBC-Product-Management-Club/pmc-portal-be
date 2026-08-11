import { supabase } from "../config/supabase";

// Deliberately its own module rather than a function in Storage.ts. That file
// carries the deliverables queries, one of which cannot be type checked under
// tsconfig.test.json (TS2589, "type instantiation is excessively deep") -- a
// pre-existing problem, but it means importing Storage.ts from anything a test
// touches fails the whole suite. Keeping this separate avoids dragging that in.

// Files uploaded with isPublic: false have only their storage path recorded, so
// reading one back needs a short-lived signed link. Used for resumes in the
// admin applicant viewer -- signed on demand rather than once per row in a list.
export const createSignedUrl = async (
    bucketName: string,
    path: string,
    expiresInSeconds = 300
): Promise<string> => {
    const { data, error } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(path, expiresInSeconds);
    if (error || !data) {
        throw new Error(
            `Failed to sign ${path}: ${error?.message ?? "no url returned"}`
        );
    }
    return data.signedUrl;
};
