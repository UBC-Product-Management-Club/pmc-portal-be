import { attempt } from "lodash";
import { Tables, TablesInsert } from "../../schema/v2/database.types";
import { AttendeeRepository } from "../../storage/AttendeeRepository";
import { getEvent } from "../Event/EventService";

type Attendee = TablesInsert<"Attendee">;

// Adds correctly
export const addAttendee = async (
  registrationData: Attendee
): Promise<Tables<"Attendee">> => {
  const attendee = await createAttendee(registrationData);

  const { data, error } = await AttendeeRepository.addAttendee(attendee);

  if (error) {
    throw new Error(`Failed to create attendee: ${error.message}`);
  }

  return data;
};

export const getAttendee = async (
  eventId: string,
  userId: string
): Promise<Tables<"Attendee"> | null> => {
  const { data: attendee, error } = await AttendeeRepository.getAttendee(
    eventId,
    userId
  );
  if (error) {
    throw new Error(
      `Failed to check if user ${userId} is registered for event ${eventId}`
    );
  }
  return attendee;
};

export const deleteAttendee = async (
  attendeeId: string
): Promise<{ message: string }> => {
  const { error } = await AttendeeRepository.deleteAttendee(attendeeId);
  if (error) {
    throw new Error(
      `Failed to delete attendee ${attendeeId}: ${error.message}`
    );
  }

  return { message: `deleted attendee ${attendeeId}` };
};

export const createAttendee = async (
  registrationData: Attendee
): Promise<Attendee> => {
  const { user_id, event_id } = registrationData;
  const event = await getEvent(event_id);

  if (!user_id || !event_id) {
    throw new Error("Missing required fields");
  }

  if (!event || (event && Object.keys(event).length == 0)) {
    throw new Error(`Event missing: ${event_id}`);
  }

  if (event.max_attendees === event.registered) {
    throw new Error(`Event ${event_id} is full!`);
  }

  if (
    (await AttendeeRepository.getRegisteredAttendee(event_id, user_id)).data
  ) {
    throw new Error(`User already registered for event`);
  }

  return {
    ...registrationData,
    status: event.needs_review ? "APPLIED" : "PROCESSING",
  };
};

export const getTeam = async (attendee_id: string) => {
  const { data: teamData, error: teamIdError } =
    await AttendeeRepository.getTeamId(attendee_id);
  if (!teamData) {
    throw new Error("No team found");
  }
  if (teamIdError) {
    throw new Error("Supabase error: " + teamIdError);
  }
  const team_id = teamData.team_id;
  const { data: teamNameData, error: teamError } =
    await AttendeeRepository.getTeamName(team_id);

  if (teamError) {
    throw new Error("Supabase error: " + teamError.message);
  }
  if (!teamNameData) {
    throw new Error("Team not found");
  }
  const { data: members, error: membersError } =
    await AttendeeRepository.getTeamMembers(team_id);

  if (membersError) throw new Error("Supabase error: " + membersError.message);

  const teammates =
    members?.map((m) => ({
      attendee_id: m.attendee_id,
      user_id: m.Attendee?.user_id,
      name: m.Attendee?.User?.first_name + " " + m.Attendee?.User?.last_name,
      email: m.Attendee?.User?.email,
    })) ?? [];

  return {
    team_id,
    team_name: teamNameData.team_name,
    members: teammates,
  };
};
