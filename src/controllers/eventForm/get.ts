import {db} from "../../config/firebase";
import {EventForm} from "../../schema/EventForm";

export const getEventForm = async (uid: string): Promise<EventForm | undefined> => {
    const docRef = db.collection("eventForms").doc(uid)
    const userRef = await docRef.get()
    return userRef.data() as EventForm | undefined
}