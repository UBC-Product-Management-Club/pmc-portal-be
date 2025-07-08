import { db } from "../../config/firebase";
import { supabase } from "../../config/supabase";
import { FirebaseEvent } from "../../schema/v1/FirebaseEvent";
import { SupabaseEvent } from "../../schema/v2/SupabaseEvent";

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

const getSupabaseEvents = async (): Promise<SupabaseEvent[]> => {
    try {

        const {data, error} = await supabase.from('Event').select();
        if (error || !data) {
            throw new Error('Failed to fetch events: ' + error?.message);
        }
        const events: SupabaseEvent[] = data.map(doc => ({
            event_id: doc.event_id,
            ...doc as Omit<SupabaseEvent, 'event_id'>
        }));
        return events;

    } catch (error) {
        console.error("Error fetching events: ", error);
        throw error;
    }
};

const getSupabaseEventById = async (id: string): Promise<SupabaseEvent | null> => {
    
    try {

        const {data, error } = await supabase.from('Event').select().eq('event_id', id).single();

        if (error || !data) {
            throw new Error('Failed to fetch events: ' + error?.message);
        }


        const event: SupabaseEvent = {
            event_id: data.event_id,
            ...data as Omit<SupabaseEvent, 'event_id'>
        };
        return event
    } catch (error) {
        console.error("Error fetching events: ", error);
        throw error;
    }

};

export { getEvents, getEventById, addEvent, getSupabaseEvents, getSupabaseEventById};
