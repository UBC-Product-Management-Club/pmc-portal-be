import { db } from "../../config/firebase";
import { Event } from "../../schema/Event";
import { storage } from "../../config/firebase";
import { getStorage, getDownloadURL } from "firebase-admin/storage"

const getEvents = async (): Promise<Event[]> => {
    const eventsCollection = db.collection('events');
    const snapshot = await eventsCollection.get();

    if (snapshot.empty) {
        console.log('No matching documents.');
        return [];
    }

    const events: Event[] = snapshot.docs.map(doc => ({
        event_Id: doc.id,
        ...doc.data() as Omit<Event, 'event_Id'>
    }));

    return events;
};

const getEventById = async (id: string): Promise<Event | null> => {
    const eventDoc = db.collection('events').doc(id);
    const doc = await eventDoc.get();

    if (!doc.exists) {
        console.log('No such document!');
        return null;
    }

    const event: Event = {
        event_Id: id,
        ...doc.data() as Omit<Event, 'event_Id'>
    };

    return event;
};

const addEvent = async (event_Id: string, event: Event): Promise<void> => {
    try {
        // enforce types in firestore
        const eventJson: Event = {
            ...event, 
            attendee_Ids: JSON.parse(event.attendee_Ids as string),
            member_price: parseInt(event.member_price as string) as number, 
            non_member_price: parseInt(event.non_member_price as string) as number,
            member_only: Boolean(JSON.parse(event.member_only as string))
        }
        await db.collection('events').doc(event_Id).set(eventJson);
    } catch (error) {
        console.error('Error adding event to database: ', error);
        throw new Error('Failed to add event');
    }
};

const uploadEventMedia = async (eventId: string, media: Express.Multer.File[]) : Promise<string[]> => {
    const bucketName = process.env.BUCKET_NAME!;
    const downloadURLs: string[] = [];
    for (const file of media) {
        const filePath = `events/${eventId}/media/${file.originalname}`;
        try{
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



export { getEvents, getEventById, addEvent, uploadEventMedia };
