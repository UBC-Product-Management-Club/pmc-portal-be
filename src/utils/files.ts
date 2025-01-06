import { storage } from "../config/firebase";
import { getStorage, getDownloadURL } from "firebase-admin/storage"

export const uploadFiles = async (media: Express.Multer.File[], parentPath: string): Promise<string[]> => {
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
