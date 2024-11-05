import { db } from "../../config/firebase";
import { FieldValue } from 'firebase-admin/firestore';
import { Attendee, Event } from "../../schema/Event";

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

        const eventData = eventDoc.data() as Event;

        if (eventData.maxAttendee !== -1 && eventData.attendee_Ids.length >= eventData.maxAttendee) {
            throw new Error('The event has reached the maximum number of attendees');
        }

        await db.collection('attendees').doc(attendee.attendee_Id).set(attendee);
        await eventIDAttendee.update({
            attendee_Ids: FieldValue.arrayUnion(attendee.attendee_Id)
        });
    } catch (error) {
        console.error('Error adding a new attendee to database: ', error);
        throw new Error(`Failed to add a new attendee: ${error}`);
    }
};

export { getAttendeeById, addAttendee };
