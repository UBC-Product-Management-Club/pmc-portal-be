import _ from "lodash";
import { Tables } from "../../schema/v2/database.types";
import { EventInsert } from "../../schema/v2/Event";
import { EventRepository } from "../../storage/EventRepository";

type EventRow = Tables<"Event">;
type EventCreate = EventInsert;
type EventInformation = EventRow & { registered: number };

export const getEvents = async () => {
  const { data, error } = await EventRepository.getEvents();
  if (error) throw new Error(error.message);
  return data as Partial<EventRow>[];
};

export const getEvent = async (
  id: string
): Promise<EventInformation | null> => {
  const { data, error } = await EventRepository.getEvent(id);
  if (error) throw new Error(error.message);
  if (!data) return null;

  return { ..._.omit(data, "Attendee"), registered: data.Attendee[0].count };
};

export const getRegisteredEvents = async (userId: string) => {
  const { data, error } = await EventRepository.getRegisteredEvents(userId);
  if (error) throw new Error(error.message);
  return data.map((row) => row.Event);
};

export const getEventPriceId = async (eventId: string, isMember: boolean) => {
  const field = isMember ? "member_price_id" : "non_member_price_id";
  const { data } = await EventRepository.getEventPriceId(eventId, field);

  if (!data) throw new Error("Event price id not found");
  return (data as Record<typeof field, string>)[field];
};

export const addEvent = async (event: EventCreate) => {
  const { error } = await EventRepository.addEvent(event);
  if (error) throw error;
};

export const isFull = async (eventId: string) => {
  const { data, error } = await EventRepository.getCapacityStatus(eventId);
  if (error) throw error;
  if (!data || data.max_attendees == null)
    throw new Error("Event not found or max_attendees missing");

  const registeredCount = data.attendees?.length ?? 0;
  return registeredCount >= data.max_attendees;
};

export type { EventInformation };
