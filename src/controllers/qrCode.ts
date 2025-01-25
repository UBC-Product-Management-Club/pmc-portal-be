import { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { db } from "../config/firebase";

// step 2: after entering the qr code link, check if user email is in local strg
export const checkEmail = async (email: string) => {
    try {

        // const localEmail = localStorage.getItem(email); // move to frontend

        const attendeesDoc = await db.collection('attendees').get();
        if (attendeesDoc.empty) {
            console.log("No attendees found.");
        }

        // emails from firebase - attendees
        const emails = attendeesDoc.docs.map((doc: QueryDocumentSnapshot) => {
            const data = doc.data();
            return data.email;
        });

        if (!emails.includes(email)) {
            console.error('Email not found in the database');
            return false;
        }
        return true;
    } catch (error) {
        console.error('An unexpected error occured while checking the email', error);
        throw new Error('Failed to check email: ' + (error as Error).message);
    }
}

