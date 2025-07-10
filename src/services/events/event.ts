import { db } from "../../config/firebase";
import { Event } from "../../schema/Event";

const getEvents = async (): Promise<Event[]> => {
    const eventsCollection = db.collection('events');
    const snapshot = await eventsCollection.orderBy('date').get();

    if (snapshot.empty) {
        console.log('No matching documents.');
        return [];
    }

    const events: Event[] = snapshot.docs.map(doc => ({
        event_Id: doc.id,
        ...doc.data() as Omit<Event, 'event_Id'>
    }));

    return events;
};

const getEventById = async (id: string): Promise<Event | null> => {
    const eventDoc = db.collection('events').doc(id);
    const doc = await eventDoc.get();

    if (!doc.exists) {
        console.log('No such event document!', id);
        return null;
    }

    const event: Event = {
        event_Id: id,
        ...doc.data() as Omit<Event, 'event_Id'>
    };

    return event;
};

const addEvent = async (event_Id: string, event: Event): Promise<void> => {
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

const getSupabaseEvents = async (): Promise<{message: string}> => {

    return {message: "getting all events"};
};

const getSupabaseEventById = async (id: string): Promise<{message: string, attendee_Ids: Array<string>}> => {

    return {message: `getting event by ${id}`, attendee_Ids: []};
};

export { getEvents, getEventById, addEvent, getSupabaseEvents, getSupabaseEventById};
