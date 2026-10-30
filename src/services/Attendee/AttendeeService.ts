import { Enums, Tables } from "../../schema/v2/database.types";
import { AttendeeRepository } from "../../storage/AttendeeRepository";
import { TeamRepository } from "../../storage/TeamRepository";
import { ApiError } from "../ApiError";
import { workflowState, WorkflowState } from "./workflowState";

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

export type AttendeeStatus = Tables<"Attendee"> & {
  workflow_state: WorkflowState | null;
  // The student's price today, only while they're Accepted
  amount_due: number | null;
  server_time: string;
};

// The attendee as the event page reads it, or null when the student hasn't applied
export const getAttendeeStatus = async (
  eventId: string,
  userId: string,
  now = new Date()
): Promise<AttendeeStatus | null> => {
  const { data, error } = await AttendeeRepository.getAttendeeForStatus(eventId, userId);
  if (error) {
    throw new Error(`Failed to load attendee for ${userId} at event ${eventId}: ${error.message}`);
  }
  if (!data) return null;

  const { Event: event, User: user, ...attendee } = data;
  const price = user.is_payment_verified ? event.member_price : event.non_member_price;
  return {
    ...attendee,
    workflow_state: workflowState(attendee, now),
    amount_due: attendee.status === "ACCEPTED" ? price : null,
    server_time: now.toISOString(),
  };
};

export const updateAttendee = async (
  attendeeId: string,
  data: Partial<Tables<"Attendee">>
): Promise<void> => {
  const { error } = await AttendeeRepository.updateAttendee(attendeeId, data);
  if (error) {
    throw new Error(
      `Failed to update attendee ${attendeeId} with data ${data}`
    );
  }
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

// The database raises these by name; anything else is a server error
const APPLICATION_ERRORS: Record<string, [number, string]> = {
  NOT_FOUND: [404, "This event doesn't exist."],
  NOT_OPEN: [403, "Applications aren't open yet."],
  CLOSED: [403, "Applications for this event are closed."],
  ALREADY_APPLIED: [409, "You've already applied to this event."],
  EVENT_FULL: [409, "This event is full."],
};

export const submitApplication = async (
  eventId: string,
  userId: string,
  answers: Record<string, string>
): Promise<Tables<"Attendee">> => {
  const { data, error } = await AttendeeRepository.submitApplication(eventId, userId, answers);
  if (error) {
    const code = Object.keys(APPLICATION_ERRORS).find((c) => error.message.includes(c));
    if (code) {
      const [status, message] = APPLICATION_ERRORS[code];
      throw new ApiError(status, code, message);
    }
    throw new Error(`Failed to submit application: ${error.message}`);
  }
  return data as Tables<"Attendee">;
};

// Free and no-review events: true when the student got a seat, false when the event was full
export const registerIfSeatAvailable = async (attendeeId: string, paymentId?: string): Promise<boolean> => {
  const { data, error } = await AttendeeRepository.registerIfSeatAvailable(attendeeId, paymentId);
  if (error) {
    throw new Error(`Failed to register attendee ${attendeeId}: ${error.message}`);
  }
  return data === true;
};

export const getAttendeeWithEvent = async (attendeeId: string) => {
  const { data, error } = await AttendeeRepository.getAttendeeWithEvent(attendeeId);
  if (error) {
    throw new Error(`Failed to load attendee ${attendeeId}: ${error.message}`);
  }
  return data;
};

export const updateAttendeeStatus = async (
  attendee_id: string,
  status: Enums<"ATTENDEE_STATUS">
) => {
  await AttendeeRepository.updateAttendee(attendee_id, { status });
};

export const getTeam = async (attendee_id: string) => {
  const { data: teamData, error: teamIdError } =
    await TeamRepository.getTeamByAttendee(attendee_id);
  if (!teamData) {
    throw new Error("No team found");
  }
  if (teamIdError) {
    throw new Error("Supabase error: " + teamIdError);
  }

  return teamData;
};
