import { Tables } from "../../schema/v2/database.types";
import { TeamRepository } from "../../storage/TeamRepository";
import { getAttendee } from "../Attendee/AttendeeService";

const generateTeamCode = (length: number): string => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(
    { length },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join("");
};

export const getUserTeam = async (
  eventId: string,
  userId: string
): Promise<any> => {
  const attendeeData = await getAttendee(eventId, userId);
  if (!attendeeData) {
    throw new Error("Attendee not found for this event and user.");
  }

  const { data: teamData, error: teamError } =
    await TeamRepository.getTeamByAttendee(attendeeData.attendee_id);

  if (teamError || !teamData) {
    throw new Error("User is not in a team for this event.");
  }

  return teamData;
};

export const createUserTeam = async (
  eventId: string,
  userId: string,
  teamName: string
) => {
  const attendee = await getAttendee(eventId, userId);
  if (!attendee) {
    throw new Error("Attendee not found for this event and user.");
  }

  let team: Tables<"Team"> | null = null;

  while (true) {
    const team_code = generateTeamCode(5);

    const { data, error } = await TeamRepository.createTeam({
      event_id: eventId,
      team_name: teamName,
      team_code,
    });

    if (error) {
      if (error.code === "23505") {
        if (error.message.includes("Team_event_id_team_name_idx")) {
          throw error;
        }
        if (error.message.includes("Team_team_code_key")) {
          // retry only for duplicate team_code
          continue;
        }

        throw error;
      }
      throw error;
    }

    team = data;
    break;
  }

  // Insert member into that team
  const { error: memberError } = await TeamRepository.addMember({
    team_id: team!.team_id,
    attendee_id: attendee.attendee_id,
  });

  if (memberError) {
    if (memberError.code === "23505") {
      // Attendee is already assigned to a team
      //   throw new Error("User is already in a team for this event.");
      console.log(memberError);
      throw memberError;
    }
    throw new Error(`Failed to add attendee to team: ${memberError.message}`);
  }

  // Fetch full team
  const { data: fullTeam } = await TeamRepository.getTeamByAttendee(
    attendee.attendee_id
  );
  return fullTeam;
};

export const joinTeamWithCode = async (
  eventId: string,
  userId: string,
  teamCode: string
): Promise<any> => {
  const attendeeData = await getAttendee(eventId, userId);
  if (!attendeeData) {
    throw new Error("Attendee not found for this event and user.");
  }

  const existingTeam = await TeamRepository.getTeamByAttendee(
    attendeeData.attendee_id
  );
  if (existingTeam.data) {
    throw new Error("User is already in a team for this event.");
  }

  const { data: teamData, error: teamError } =
    await TeamRepository.getTeamByCode(eventId, teamCode);

  if (teamError || !teamData) {
    throw new Error("Team with the provided code not found.");
  }

  if (teamData.Team_Member && teamData.Team_Member.length >= 4) {
    throw new Error("This team is already full.");
  }

  const { error: memberError } = await TeamRepository.addMember({
    team_id: teamData.team_id,
    attendee_id: attendeeData.attendee_id,
  });

  if (memberError) {
    throw new Error(`Failed to add attendee to team: ${memberError.message}`);
  }

  const { data: fullTeam, error: fullError } =
    await TeamRepository.getTeamByAttendee(attendeeData.attendee_id);

  if (fullError || !fullTeam) {
    throw new Error(
      `Failed to fetch full team after joining: ${
        fullError?.message ?? "unknown error"
      }`
    );
  }

  return fullTeam;
};

export const leaveUserTeam = async (
  eventId: string,
  userId: string
): Promise<{ message: string }> => {
  const attendeeData = await getAttendee(eventId, userId);
  if (!attendeeData) {
    throw new Error("Attendee not found for this event and user.");
  }

  const { data: teamData, error: teamError } =
    await TeamRepository.getTeamByAttendee(attendeeData.attendee_id);

  if (teamError || !teamData) {
    throw new Error("User is not in a team for this event.");
  }

  const { error: removeError } = await TeamRepository.removeMember(
    teamData.team_id,
    attendeeData.attendee_id
  );

  if (removeError) {
    throw new Error(
      `Failed to remove attendee from team: ${removeError.message}`
    );
  }

  return { message: "Successfully left the team." };
};
