import { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { db } from "../config/firebase";

// step 2: after entering the qr code link, check if user email is in local strg
export const checkEmail = async (email: string, event_id: string) => {
    try {

        // const localEmail = localStorage.getItem(email); // move to frontend

        const attendeesRef = await db.collection('attendees');
        const attendeesDoc = await attendeesRef.where("event_Id", "==", event_id).where("email", "==", email).get()
        if (attendeesDoc.empty) {
            console.log("No attendee found.");
            return null
        }

        const attendee = attendeesDoc.docs.map(data => {
            return data.id
        })

        return attendee[0];
    } catch (error) {
        console.error('An unexpected error occured while checking the email', error);
        throw new Error('Failed to check email: ' + (error as Error).message);
    }
}

