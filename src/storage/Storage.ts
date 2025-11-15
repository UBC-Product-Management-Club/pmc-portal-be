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


const uploadSupabaseFiles = async (files: Express.Multer.File[],  { parentPath, bucketName, isPublic }: UploadOptions): Promise<Record<string, string>> => {
    const result: Record<string, string> = {};

    for (const file of files) {
        const safeName = sanitizeFileName(file.originalname);
        const filePath = `${parentPath}${file.fieldname}-${safeName}`;

        // Upload file to Supabase bucket 
        const { data: uploadData, error: uploadError} = await supabase.storage.from(bucketName).upload(filePath, file.buffer, {upsert: true})
        if (uploadError) {
            throw uploadError;
        }

        if (isPublic) {
            const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(uploadData.path)
            result[file.fieldname] = publicUrlData.publicUrl;
        } else {
            result[file.fieldname] = filePath;
        }
    }
    return result
}


export { uploadSupabaseFiles};
