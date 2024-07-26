import { db } from "../../config/firebase";
import { FieldValue } from 'firebase-admin/firestore';
import { Attendee } from "./types";

// const getAttendees = async (): Promise<Attendee[]> => {
//     const attendeesCollection = db.collection('events');
//     const snapshot = await attendeesCollection.get();

//     if (snapshot.empty) {
//         console.log('No matching attendees.');
//         return [];
//     }

//     const attendees: Attendee[] = snapshot.docs.map(doc => ({
//         attendee_Id: doc.id,
//         ...doc.data() as Omit<Attendee, 'attendee_Id'>
//     }));

//     return attendees;
// };

const getAttendeeById = async (id: string): Promise<Attendee | null> => {
    const attendeeDoc = db.collection('attendees').doc(id);
    const doc = await attendeeDoc.get();

    if (!doc.exists) {
        console.log('No such document!');
        return null;
    }

    const attendee: Attendee = {
        attendee_Id: id,
        ...doc.data() as Omit<Attendee, 'attendee_Id'>
    };

    return attendee;
};

const addAttendee = async (attendee_Id: string, attendee: Attendee, eventId: string): Promise<void> => {
    const eventIDAttendee = db.collection('events').doc(attendee.event_Id);

    try {
        await db.collection('attendees').doc(attendee_Id).set(attendee);
        await eventIDAttendee.update({
            attendees: FieldValue.arrayUnion(attendee_Id)
        });
    } catch (error) {
        console.error('Error adding a new attendee to database: ', error);
        throw new Error('Failed to add a new attendee');
    }
};

export { getAttendeeById, addAttendee };