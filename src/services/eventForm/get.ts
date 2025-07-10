import {db} from "../../config/firebase";
import {EventForm} from "../../schema/v1/EventForm";

export const getEventForm = async (uid: string): Promise<EventForm | undefined> => {
    const docRef = db.collection("eventForms").doc(uid)
    const userRef = await docRef.get()
    if (!userRef.exists) {
        throw new Error("Event form doesn't exist")
    }
    return userRef.data() as EventForm | undefined
}