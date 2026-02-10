import { supabase } from "../config/supabase";
import { Tables } from "../schema/v2/database.types";
import { EventInsert } from "../schema/v2/Event";

type EventRow = Tables<"Event">;
type EventCreate = EventInsert;

export const EventRepository = {
  getEvents: () =>
    supabase
      .from("Event")
      .select(
        "event_id, name, blurb, date, start_time, end_time, location, member_price, non_member_price, thumbnail, is_disabled"
      )
      .order("date", { ascending: false }),
  getEvent: (eventId: string) =>
    supabase
      .from("Event")
      .select("*, Attendee(count)")
      .eq("event_id", eventId)
      .eq("Attendee.is_payment_verified", true)
      .maybeSingle(),
  getRegisteredEvents: (userId: string) =>
    supabase
      .from("Attendee")
      .select(
        `
        Event!inner (
          event_id,
          name,
          blurb,
          date,
          start_time,
          end_time,
          location,
          member_price,
          non_member_price,
          thumbnail,
          is_disabled,
          external_page
        )
      `
      )
      .eq("user_id", userId)
      .or("status.eq.ACCEPTED,status.eq.REGISTERED")
      .gte("Event.end_time", new Date().toISOString())
      .order("date", { referencedTable: "Event", ascending: false }),
  getEventPriceId: (
    eventId: string,
    selectField: "member_price_id" | "non_member_price_id"
  ) =>
    supabase.from("Event").select(selectField).eq("event_id", eventId).single(),
  addEvent: (event: EventCreate) => supabase.from("Event").insert(event),
  getCapacityStatus: (eventId: string) =>
    supabase
      .from("Event")
      .select(
        `
        max_attendees,
        attendees:Attendees!inner(event_id)
      `
      )
      .eq("event_id", eventId)
      .single(),
  getMailingList: (eventId: string) =>
    supabase
      .from("Event")
      .select("mailing_list")
      .eq("event_id", eventId)
      .single(),
  getEventDeliverableFlags: (eventId: string) =>
    supabase
      .from("Deliverable_Flags")
      .select("*")
      .eq("event_id", eventId)
};
