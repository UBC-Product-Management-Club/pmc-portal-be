import { supabase } from "../config/supabase";

const uploadSupabaseFiles = async (input: Express.Multer.File[], parentPath: string): Promise<string[]> => {
    const bucketName = process.env.SUPABASE_BUCKET_NAME!;
    const publicURLs: string[] = [];

    for (const file of input) {
        const filePath = `${parentPath}${file.originalname}`;

        // Upload file to Supabase bucket and get download url (bucket must be set to public)
        const { data: uploadData, error: uploadError} = await supabase.storage.from(bucketName).upload(filePath, file.buffer, {upsert: true})
        if (uploadError) {
            throw uploadError;
        }
        const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(uploadData.path)
        publicURLs.push(publicUrlData.publicUrl);
    }
    return publicURLs
}


export { uploadSupabaseFiles};
