import { storage } from "../config/firebase";
import { getStorage, getDownloadURL } from "firebase-admin/storage"
import { supabase } from "../config/supabase";

const uploadFiles = async (media: Express.Multer.File[], parentPath: string): Promise<string[]> => {
    const bucketName = process.env.BUCKET_NAME!;
    const downloadURLs: string[] = [];
    for (const file of media) {
        const filePath = `${parentPath}${file.originalname}`;
        try {
            // upload file to Cloud Storage and get download url
            await storage.bucket(bucketName).file(filePath).save(file.buffer);
            const fileRef = getStorage().bucket(bucketName).file(filePath);
            const downloadURL = await getDownloadURL(fileRef);
            downloadURLs.push(downloadURL);
        } catch (error) {
            throw error
        }
    }
    return downloadURLs
}

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


export { uploadFiles, uploadSupabaseFiles};
