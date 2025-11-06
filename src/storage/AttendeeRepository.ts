import { supabase } from "../config/supabase";
import { TablesInsert } from "../schema/v2/database.types";

type Attendee = TablesInsert<"Attendee">;

export const AttendeeRepository = {
  addAttendee: (attendee: Attendee) =>
    supabase.from("Attendee").insert(attendee).select().single(),
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
    supabase.from("Attendee").delete().eq("attendee_id", attendeeId),
  countByEvent: (eventId: string) =>
    supabase
      .from("Attendee")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId),
  updateAttendee: async (attendeeId: string, updates: Record<string, any>) =>
    supabase.from("Attendee").update(updates).eq("attendee_id", attendeeId),
  getEmailAndMailingListByAttendee: async (attendeeId: string) =>
    supabase
      .from("Attendee")
      .select(
        `
        User!inner ( email ),
        Event!inner ( mailing_list )
        `
      )
      .eq("attendee_id", attendeeId)
      .single(),
  getTeamId: (attendeeId: string) =>
    supabase
      .from("Team_Member")
      .select("team_id")
      .eq("attendee_id", attendeeId)
      .single(),
  getTeamName: (teamId: string) =>
    supabase.from("Team").select("team_name").eq("team_id", teamId).single(),
  getTeamMembers: (teamId: string) =>
    supabase
      .from("Team_Member")
      .select(
        `
          attendee_id,
          Attendee (
              user_id,
              User (
                  first_name,
                  last_name,
                  email
              )
          )
      `
      )
      .eq("team_id", teamId),
};
