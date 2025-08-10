import { db } from "../../config/firebase";
import { supabase } from "../../config/supabase";
import { FirebaseEvent } from "../../schema/v1/FirebaseEvent";
import { Tables } from "../../schema/v2/database.types";
import type { Database } from '../../schema/v2/database.types';


type EventInsert = Database['public']['Tables']['Event']['Insert'];

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

    const { data, error: fetchEventError } = await supabase.from('Event').select().eq('event_id', id).single();

    if (!data || fetchEventError) {
        console.error("Error fetching event: ", fetchEventError);
        throw new Error(`Failed to fetch event ${id}: ` + fetchEventError?.message);
    }

    const { count: registered, error: fetchCapacityError } = await supabase.from('Attendee').select('*', { count: 'exact', head: true} ).eq('event_id', id)
    if (fetchCapacityError || registered === null) {
        console.error("Error fetching event capacity: ", fetchCapacityError);
        throw new Error(`Failed to fetch capacity for event ${id}: ${fetchCapacityError?.message}`)
    }


    return { ...data, registered };
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


const getEventCapacity = async (eventId: string): Promise<number> => {
    const { count, error } = await supabase.from('Attendee').select('*', { count: 'exact', head: true} ).eq('event_id', eventId)
    if (error || count === null) {
        throw error
    }
    return count
}


export { getEvents, getEventById, addEvent, getSupabaseEvents, getSupabaseEventById, addSupabaseEvent};
