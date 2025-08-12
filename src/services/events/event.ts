import { db } from "../../config/firebase";
import { supabase } from "../../config/supabase";
import { FirebaseEvent } from "../../schema/v1/FirebaseEvent";
import { Tables } from "../../schema/v2/database.types";
import type { Database } from '../../schema/v2/database.types';


type EventInsert = Database['public']['Tables']['Event']['Insert'];

type AttendeeWithEvent = {
  Event: Tables<'Event'>;
};

const getEvents = async (): Promise<FirebaseEvent[]> => {
    const eventsCollection = db.collection('events');
    const snapshot = await eventsCollection.orderBy('date').get();

    if (snapshot.empty) {
        console.log('No matching documents.');
        return [];
    }

    const events: FirebaseEvent[] = snapshot.docs.map(doc => ({
        event_Id: doc.id,
        ...doc.data() as Omit<FirebaseEvent, 'event_Id'>
    }));

    return events;
};

const getEventById = async (id: string): Promise<FirebaseEvent | null> => {
    const eventDoc = db.collection('events').doc(id);
    const doc = await eventDoc.get();

    if (!doc.exists) {
        console.log('No such event document!', id);
        return null;
    }

    const event: FirebaseEvent = {
        event_Id: id,
        ...doc.data() as Omit<FirebaseEvent, 'event_Id'>
    };

    return event;
};

const addEvent = async (event_Id: string, event: FirebaseEvent): Promise<void> => {
    try {
        const dateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
        const timeRegex = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;
        
        if (!dateRegex.test(event.date)) {
            throw new Error("Event date invalid. Must be ISO format (YYYY-MM-DD).")
        }

        if (!timeRegex.test(event.start_time)) {
            throw new Error("Start time invalid. Must be ISO format (Thh:mm:ss).")
        }

        if (!timeRegex.test(event.end_time)) {
            throw new Error("End time invalid. Must be ISO format (Thh:mm:ss).")
        }

        await db.collection('events').doc(event_Id).set(event);
    } catch (error) {
        console.error('Error adding event to database: ', error);
        throw new Error('Failed to add event');
    }
};


// supabase services
const getSupabaseEvents = async (): Promise<Partial<Tables<'Event'>>[]> => {
    const {data, error} = await supabase.from('Event')
        .select("event_id, name, description, date, start_time, end_time, location, member_price, non_member_price, thumbnail, is_disabled")
        .order("date", { ascending: false })
    if (error || !data) {
        console.error("Error fetching events: ", error);
        throw new Error('Failed to fetch events: ' + error?.message);
    }
    return data;
};

const getSupabaseEventById = async (id: string): Promise<Tables<'Event'> | null> => {

    const {data, error } = await supabase.from('Event').select().eq('event_id', id).single();

    if (error || !data) {
        console.error("Error fetching event: ", error);
        throw new Error(`Failed to fetch event ${id}: ` + error?.message);
    }

    return data;

};

const getSupabaseUserCurrentEvents = async (userId: string): Promise<Tables<'Event'>[]> => {

    const { data: attendeeData, error: attendeeError } = await supabase
    .from('Attendee')
    .select('event_id')
    .eq('user_id', userId);

    if (attendeeError || !attendeeData) throw new Error(attendeeError.message);

    const eventIds = attendeeData.map(row => row.event_id);

    // can check here whether isDisabled or not, or make new column like 'isActive?' -> whether or not we display the event
    const { data: eventsData, error: eventsError } = await supabase
    .from('Event')
    .select('*')
    .in('event_id', eventIds)
    .order("date", { ascending: false });

    if (eventsError || !eventsData) throw new Error(eventsError.message);

    return eventsData;
};


const addSupabaseEvent = async (event: EventInsert): Promise<void> => {
    const { date, start_time, end_time } = event;

    // This should never trigger if controller properly validates the fields
    if (!date || !start_time || !end_time) {
        throw new Error("Missing required fields.");
    }

    const dateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
    const isoTimestampRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})?$/;
    
    if (!dateRegex.test(date)) {
        console.log("Date from form:", date);
        throw new Error("Event date invalid. Must be ISO format (YYYY-MM-DD).")
    }

    if (!isoTimestampRegex.test(start_time)) {
        throw new Error("Start time invalid. Must be ISO format (Thh:mm:ss).")
    }

    if (!isoTimestampRegex.test(end_time)) {
        throw new Error("End time invalid. Must be ISO format (Thh:mm:ss).")
    }

    const { error } = await supabase.from('Event').insert(event)
        if (error) {
        throw new Error("Failed to insert event due to unexpected error: " + error.message);
    } 

}

export { getEvents, getEventById, addEvent, getSupabaseEvents, getSupabaseEventById, addSupabaseEvent, getSupabaseUserCurrentEvents};
