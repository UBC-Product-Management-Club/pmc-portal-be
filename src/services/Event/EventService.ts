import _ from "lodash";
import { supabase } from "../../config/supabase";
import { Tables, TablesUpdate } from "../../schema/v2/database.types";
import { EventInsert, EventUpdate } from "../../schema/v2/Event";
import { EventRepository } from "../../storage/EventRepository";
import { stripe } from "../../config/stripe";

type EventRow = Tables<"Event">;
type EventCreate = EventInsert;
type EventInformation = EventRow & { registered: number };
type EventMedia = { thumbnail: string | null; media: string[] | null };

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

  data.member_price = data.member_price_id
    ? (await stripe.prices.retrieve(data.member_price_id)).unit_amount! / 100
    : 0;
  data.non_member_price = data.non_member_price_id
    ? (await stripe.prices.retrieve(data.non_member_price_id)).unit_amount! /
      100
    : 0;

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

// Stripe prices are immutable once created, so a price change means creating a new
// Price object rather than editing the old one. The Product is reused across edits
// (created once, on the first price set) so an event's prices stay grouped together
// in Stripe instead of spawning a new Product every time an admin tweaks a price.
const syncStripePrice = async (
  eventName: string,
  label: "Member" | "Non-Member",
  existingPriceId: string | null,
  newAmountDollars: number
): Promise<string> => {
  const unitAmount = Math.round(newAmountDollars * 100);

  if (existingPriceId) {
    const existingPrice = await stripe.prices.retrieve(existingPriceId);
    if (existingPrice.unit_amount === unitAmount) {
      return existingPriceId;
    }
    const productId =
      typeof existingPrice.product === "string"
        ? existingPrice.product
        : existingPrice.product.id;
    const newPrice = await stripe.prices.create({
      product: productId,
      unit_amount: unitAmount,
      currency: existingPrice.currency,
    });
    return newPrice.id;
  }

  const product = await stripe.products.create({
    name: `${eventName} - ${label} Price`,
  });
  const newPrice = await stripe.prices.create({
    product: product.id,
    unit_amount: unitAmount,
    currency: "cad",
  });
  return newPrice.id;
};

export const updateEvent = async (
  eventId: string,
  fields: EventUpdate
): Promise<EventInformation | null> => {
  const { member_price, non_member_price, ...rest } = fields;
  const patch: TablesUpdate<"Event"> & { thumbnail?: string | null } = { ...rest };
  // Keep the denormalized `date` column in sync with the start of the event.
  if (fields.start_time) {
    patch.date = fields.start_time.slice(0, 10);
  }

  if (member_price !== undefined || non_member_price !== undefined) {
    const { data: pricing, error: pricingError } = await EventRepository.getEventPricing(eventId);
    if (pricingError) throw new Error(pricingError.message);
    if (!pricing) return null;

    if (member_price !== undefined) {
      patch.member_price_id = await syncStripePrice(
        pricing.name,
        "Member",
        pricing.member_price_id,
        member_price
      );
      patch.member_price = member_price;
    }
    if (non_member_price !== undefined) {
      patch.non_member_price_id = await syncStripePrice(
        pricing.name,
        "Non-Member",
        pricing.non_member_price_id,
        non_member_price
      );
      patch.non_member_price = non_member_price;
    }
  }

  const { data, error } = await EventRepository.updateEvent(eventId, patch);
  if (error) throw new Error(error.message);
  if (!data) return null;

  return getEvent(eventId);
};

// The image this event currently points at, read before a replacement overwrites it.
export const getEventMedia = async (eventId: string): Promise<EventMedia | null> => {
  const { data, error } = await EventRepository.getEventMedia(eventId);
  if (error) throw new Error(error.message);
  return data;
};

export const updateEventThumbnail = async (
  eventId: string,
  thumbnail: string
): Promise<EventInformation | null> => {
  const { data, error } = await EventRepository.updateEvent(eventId, {
    thumbnail,
  });
  if (error) throw new Error(error.message);
  if (!data) return null;

  return getEvent(eventId);
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

export const getEventDeliverableFlags = async (
  eventId: string,
) => {
  const data = await EventRepository.getEventDeliverableFlags(eventId);

  if (!data) throw new Error("Event price id not found");
  return data;
};

export type { EventInformation };
