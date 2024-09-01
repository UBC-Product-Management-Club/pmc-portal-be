import { db } from "../../config/firebase";
import { userDocument } from "../auth/types";

const getProfile = async (uid: string): Promise<userDocument | undefined> => {
    const docRef = db.collection("users").doc(uid)
    const userRef = await docRef.get()
    return userRef.data() as userDocument | undefined
}

const getRegisteredEvents = async(uid: string): Promise<string[] | undefined> => {
    const attendeesRef = db.collection('attendees');
    const snapshot = await attendeesRef.where('member_Id', '==', uid).get();
    const eventIds = snapshot.docs.map(doc => doc.data().event_Id);
    return eventIds;
}

export { getProfile, getRegisteredEvents }