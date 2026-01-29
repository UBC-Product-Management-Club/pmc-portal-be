import _ from "lodash";
import { supabase } from "../../config/supabase";
import { Tables } from "../../schema/v2/database.types";
import { EventInsert } from "../../schema/v2/Event";
import { EventRepository } from "../../storage/EventRepository";
import { stripe } from "../../config/stripe";

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

  const non_member_price = await stripe.prices.retrieve(await getEventPriceId(id, false));
  const member_price = await stripe.prices.retrieve(await getEventPriceId(id, true));

  return { ..._.omit(data, "Attendee"), member_price: (member_price.unit_amount! / 100), non_member_price: (non_member_price.unit_amount! / 100), registered: data.Attendee[0].count };
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

export const createEventTeam = async (
  eventId: string,
  team_name: string,
  team_attendee_ids: string[]
) => {
  try {
    if (team_attendee_ids.length > 4) {
      throw new Error("Too many team members");
    }
    const { data, error } = await supabase.rpc("create_team_with_members", {
      p_event_id: eventId,
      p_team_name: team_name,
      p_member_attendee_ids: team_attendee_ids,
    });

    if (error) {
      console.error("Failed to create team and members:", error.message);
      throw new Error(error.message);
    }

    return data[0];
  } catch (err: any) {
    console.error("CreateEventTeam failed:", err.message);
    throw new Error(err.message);
  }
};

export type { EventInformation };
