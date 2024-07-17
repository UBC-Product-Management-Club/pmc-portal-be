import { db } from "../../config/firebase";
import { Event } from "./types";

const getEvents = async (): Promise<Event[]> => {
  const eventsCollection = db.collection("events");
  const snapshot = await eventsCollection.get();

  if (snapshot.empty) {
    console.log("No matching documents.");
    return [];
  }

  const events: Event[] = snapshot.docs.map((doc) => ({
    event_Id: doc.id,
    ...(doc.data() as Omit<Event, "event_Id">),
  }));

  return events;
};

const getEventById = async (id: string): Promise<Event | null> => {
  const eventDoc = db.collection("events").doc(id);
  const doc = await eventDoc.get();

  if (!doc.exists) {
    console.log("No such document!");
    return null;
  }

  const event: Event = {
    event_Id: id,
    ...(doc.data() as Omit<Event, "event_Id">),
  };

  return event;
};

export { getEvents, getEventById };
