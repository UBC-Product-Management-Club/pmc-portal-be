import { db } from "../../config/firebase";
import { Event } from "./types";

const getEvents = async (): Promise<Event[]> => {
    const eventsCollection = db.collection('events');
    const snapshot = await eventsCollection.get();

    if (snapshot.empty) {
        console.log('No matching documents.');
        return [];
    }

    const events: Event[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data() as Omit<Event, 'id'>
    }));

    return events;
};

const getEventById = async (id: string): Promise<Event | null> => {
    const eventDoc = db.collection('events').doc(id);
    const doc = await eventDoc.get();

    if (!doc.exists) {
        console.log('No such document!');
        return null;
    }

    const event: Event = {
        ...doc.data() as Omit<Event, 'id'>
    };

    return event;
};

getEvents().then(events => console.log(events)).catch(console.error);
getEventById('SodBmUY6as6qgI55L0bh').then(event => console.log(event)).catch(console.error);

export { getEvents, getEventById };