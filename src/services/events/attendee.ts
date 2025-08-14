import { db } from "../../config/firebase";
import { FieldValue, Query } from 'firebase-admin/firestore';
import { Attendee, FirebaseEvent } from "../../schema/v1/FirebaseEvent";
import { supabase } from "../../config/supabase";
import { Database } from "../../schema/v2/database.types";
import { v4 as uuidv4 } from 'uuid';
import { addUserFromGuestRegistration, findUserByEmail } from "../auth/register";

type AttendeeRow = Database['public']['Tables']['Attendee']['Row'];
type AttendeeInsert = Database['public']['Tables']['Attendee']['Insert'];
type UserInsert = Database['public']['Tables']['User']['Insert'];
type UserRow = Database['public']['Tables']['User']['Row'];


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
const addSupabaseAttendee = async (registrationData: AttendeeInsert): Promise<AttendeeRow> => {

    await checkValidAttendee(registrationData);

    const attendee: AttendeeInsert = {
        ...registrationData,
        registration_time: new Date().toISOString(),
        status: 'registered'
    }

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

const checkValidAttendee = async (registrationData: AttendeeInsert) => {
    const { user_id, event_id } = registrationData;
    
    if (!user_id || !event_id) {
        throw new Error("Missing required fields")
    }
    
    // Check if event exists
    const { data: event, error: eventError } = await supabase
        .from('Event')
        .select()
        .eq('event_id', event_id) 
        .single();

    if (eventError || !event) {
        throw new Error(`Event missing: ${eventError?.message}`)
    }

    // Check if attendee already exists
    const { data: existingAttendee } = await supabase
        .from('Attendee')
        .select('*')
        .eq('user_id', user_id)
        .eq('event_id', event_id)
        .single();
    
    if (existingAttendee) {
        throw new Error(`User already registered for event`)
    }

    // Check if event is full
    const {data, count, error: eventFullError} = await supabase
        .from('Attendee')
        .select('*', { count: 'exact', head: true }) 
        .eq('event_id', event_id);
    
    if (eventFullError) {
        throw new Error(`Error counting attendees: ${eventFullError.message}`);
    }

    if ((count ?? 0) >= event.max_attendees) {
        throw new Error("Event is full")
    }


}

const registerGuestForEvent = async (guestUser:any, attendee:any, eventId:any) => {

    if (!guestUser) {
        throw new Error("No guest user information");
    }

    const generatedUserId = uuidv4();

    const existing = await findUserByEmail(guestUser.email);
    const userId = existing ? existing.user_id : generatedUserId;

    if (!existing) {
        addUserFromGuestRegistration(guestUser, userId)
    }

    const attendeeData: AttendeeInsert = { 
        event_id: eventId,
        user_id: userId,
        event_form_answers: attendee.eventFormAnswers
    };

    
    await checkValidAttendee(attendeeData);

    const attendeeInsert: AttendeeInsert = {
        ...attendeeData,
        registration_time: new Date().toISOString(),
        status: 'registered'
    }

    const { data, error } = await supabase
        .from('Attendee')
        .insert(attendeeInsert)
        .select()
        .single();
    
    if (error) {
        throw new Error(`Failed to create attendee: ${error.message}`);
    }
    
    return data;
}

const getAttendee = async (eventId: string, userId: string): Promise<AttendeeRow> => {
    const { data: attendee, error } = await supabase.from("Attendee").select().eq('user_id', userId).eq('event_id', eventId).maybeSingle()
    if (error) {
        throw new Error(`Failed to check if user ${userId} is registered for event ${eventId}`)
    }
    return attendee
}


const getSupabaseAttendeeById = async (id: string): Promise<{message: string}> => {

    return {message: `getting attendee by ${id}`};
};



export { getAttendeeById, getAttendee, addAttendee, checkIsRegistered, getSupabaseAttendeeById, addSupabaseAttendee, checkValidAttendee, registerGuestForEvent, findUserByEmail};
