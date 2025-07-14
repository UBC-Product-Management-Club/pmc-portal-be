import { db } from "../../config/firebase";
import { FieldValue, Query } from 'firebase-admin/firestore';
import { Attendee, FirebaseEvent } from "../../schema/v1/FirebaseEvent";
import { supabase } from "../../config/supabase";
import { Database } from "../../schema/v2/database.types";

interface RegistrationData {
    userId: string;
    eventId: string;
    paymentId?: string | null;
    eventFormAnswers?: any;
}

type AttendeeRow = Database['public']['Tables']['Attendee']['Row'];
type AttendeeInsert = Database['public']['Tables']['Attendee']['Insert'];

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
        console.log('No such attendee document!');
        return null;
    }

    const attendee: Attendee = {
        attendee_Id: id,
        ...doc.data() as Omit<Attendee, 'attendee_Id'>
    };

    return attendee;
};

const checkIsRegistered = async (event_Id: string, email: string | null) => {
    const attendeesRef = db.collection('attendees')
    if (!email) {
        return false;
    }

    try {
        const q = attendeesRef
            .where('email', '==', email ?? "")
            .where('event_Id', '==', event_Id);

        const querySnapshot = await q.get();

        return !querySnapshot.empty;
    } catch (error) {
        throw new Error(`User is not registered: ${error}`);
    }
}

const addAttendee = async (attendee: Attendee): Promise<void> => {
    const eventIDAttendee = db.collection('events').doc(attendee.event_Id);
    // const attendeesRef = db.collection('attendees')
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

        const eventData = eventDoc.data() as FirebaseEvent;

        if (eventData.isDisabled === true || (eventData.maxAttendee !== -1 && eventData.attendee_Ids.length >= eventData.maxAttendee)) {
            throw new Error('The event has reached the maximum number of attendees');
        }

        if (await checkIsRegistered(attendee.event_Id, attendee.email)) {
            throw new Error('You have signed up for this event.');
        };

        // put into a function 
        // const q = attendeesRef
        //     .where('email', '==', attendee.email)
        //     .where('event_Id', '==', attendee.event_Id);

        // const querySnapshot = await q.get();

        // if (!querySnapshot.empty) {
        //     throw new Error('You have signed up for this event.');
        // }

        await db.collection('attendees').doc(attendee.attendee_Id).set(attendee);
        await eventIDAttendee.update({
            attendee_Ids: FieldValue.arrayUnion(attendee.attendee_Id)
        });
    } catch (error) {
        console.error('Error adding a new attendee to database: ', error);
        throw new Error(`Failed to add a new attendee: ${error}`);
    }
};


// supabase
const addSupabaseAttendee = async (registrationData: RegistrationData): Promise<AttendeeRow> => {
    const { userId, eventId, paymentId, eventFormAnswers } = registrationData;

    if (!userId || !eventId) {
        throw new Error('Missing required fields');
    }
    
    console.log(eventId);
    
    // Check if event exists
    const { data: event, error: eventError } = await supabase
        .from('Event')
        .select()
        .eq('event_id', eventId) 
        .single();

    console.log('Event query result:', { event, eventError });

    if (eventError || !event) {
        console.log('Event error details:', eventError);
        throw new Error(`Event not found: ${eventError?.message}`);
    }

    // Check if attendee already exists
    const { data: existingAttendee } = await supabase
        .from('Attendee')
        .select('*')
        .eq('user_id', userId)
        .eq('event_id', eventId)
        .single();
    
    if (existingAttendee) {
        throw new Error('User already registered for this event');
    }

    const attendee: AttendeeInsert = {
        user_id: userId,
        event_id: eventId,
        payment_id: paymentId || null,
        event_form_answers: eventFormAnswers,
        registration_time: new Date().toISOString(),
        status: 'registered'
    }
    console.log(attendee)

    const { data, error } = await supabase
        .from('Attendee')
        .insert(attendee)
        .select()
        .single();
    
    if (error) {
        throw new Error(`Failed to create attendee: ${error.message}`);
    }
    
    return data;
}

const getSupabaseAttendeeById = async (id: string): Promise<{message: string}> => {

    return {message: `getting attendee by ${id}`};
};

export { getAttendeeById, addAttendee, checkIsRegistered, getSupabaseAttendeeById, addSupabaseAttendee };
