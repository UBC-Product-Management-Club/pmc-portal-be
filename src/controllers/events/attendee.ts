import { db } from "../../config/firebase";
<<<<<<< HEAD
import { FieldValue } from 'firebase-admin/firestore';
import { Attendee } from "../../schema/Event";

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
=======
import { Attendee } from "./types";

const getAttendees = async (): Promise<Attendee[]> => {
    const attendeesCollection = db.collection('events');
    const snapshot = await attendeesCollection.get();

    if (snapshot.empty) {
        console.log('No matching attendees.');
        return [];
    }

    const attendees: Attendee[] = snapshot.docs.map(doc => ({
        attendee_Id: doc.id,
        ...doc.data() as Omit<Attendee, 'attendee_Id'>
    }));

    return attendees;
};
>>>>>>> 97812a6 (added the Attendee POST and GET methods)

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

<<<<<<< HEAD

const addAttendee = async (attendee: Attendee): Promise<void> => {
    const eventIDAttendee = db.collection('events').doc(attendee.event_Id);
    const checkMemberId = (uid: string): Promise<void> => {
        const memberRef = db.collection('users').doc(uid);
        return memberRef.get().then(memberDoc => {
            if (!memberDoc.exists) {
                return Promise.reject(new Error('Member ID does not exist'));
            }
        }).catch(error => {
            console.error('Error checking member ID:', error);
            return Promise.reject(new Error('Error checking member ID: ' + error.message));
        });
    };


    try {
        const eventDoc = await eventIDAttendee.get();
        if (!eventDoc.exists) {
            throw new Error('Event ID does not exist');
        }
        if (attendee.member_Id) {
            await checkMemberId(attendee.member_Id);
        }
        // const memberRef = await db.collection('users').doc(attendee.member_Id).get();
        // if (!memberRef.exists) {
        //     throw new Error('Member ID does not exist');
        // }
        // await checkMemberId(attendee.member_Id);

        await db.collection('attendees').doc(attendee.attendee_Id).set(attendee);
        await eventIDAttendee.update({
            attendees: FieldValue.arrayUnion(attendee.attendee_Id)
        });
=======
const addAttendee = async (attendee_Id: string, attendee: Attendee): Promise<void> => {
    try {
        await db.collection('attendees').doc(attendee_Id).set(attendee);
>>>>>>> 97812a6 (added the Attendee POST and GET methods)
    } catch (error) {
        console.error('Error adding a new attendee to database: ', error);
        throw new Error('Failed to add a new attendee');
    }
};

<<<<<<< HEAD
export { getAttendeeById, addAttendee };
=======
export { getAttendeeById, getAttendees, addAttendee };
>>>>>>> 97812a6 (added the Attendee POST and GET methods)
