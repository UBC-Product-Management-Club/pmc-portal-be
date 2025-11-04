import { supabase } from "../config/supabase";
import { Tables, TablesInsert } from "../schema/v2/database.types";

type Attendee = TablesInsert<"Attendee">;

export const AttendeeRepository = {
  addAttendee: (attendee: Attendee) => 
    supabase
      .from("Attendee")
      .insert(attendee)
      .select()
      .single(),
  getAttendee: (eventId: string, userId: string) =>
    supabase
      .from("Attendee")
      .select("*")
      .eq("event_id", eventId)
      .eq("user_id", userId)
      .maybeSingle(),
  getRegisteredAttendee: (eventId: string, userId: string) =>
    supabase
      .from("Attendee")
      .select("*")
      .eq("event_id", eventId)
      .eq("user_id", userId)
      .eq("is_payment_verified", true)
      .maybeSingle(),
  deleteAttendee: (attendeeId: string) =>
    supabase
      .from("Attendee")
      .delete()
      .eq("attendee_id", attendeeId),
  countByEvent: (eventId: string) =>
    supabase
      .from("Attendee")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId)
};
