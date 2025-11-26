import { Tables, TablesInsert } from "../../schema/v2/database.types";
import { TeamRepository } from "../../storage/TeamRepository";
import { getAttendee } from "../Attendee/AttendeeService";

const generateTeamCode = (length: number): string => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
};

export const getUserTeam = async (eventId: string, userId: string): Promise<any> => {
    const attendeeData = await getAttendee(eventId, userId);
    if (!attendeeData) {
        throw new Error("Attendee not found for this event and user.");
    }

    const { data: teamData, error: teamError } = await TeamRepository.getTeamByAttendee(attendeeData.attendee_id);

    if (teamError || !teamData) {
        throw new Error("User is not in a team for this event.");
    }

    return teamData;
};

export const createUserTeam = async (eventId: string, userId: string, teamName: string): Promise<Tables<"Team">> => {
    const attendeeData = await getAttendee(eventId, userId);
    if (!attendeeData) {
        throw new Error("Attendee not found for this event and user.");
    }

    const existingTeam = await TeamRepository.getTeamByAttendee(attendeeData.attendee_id);
    if (existingTeam.data) {
        throw new Error("User is already in a team for this event.");
    }

    let teamData: Tables<"Team"> | null = null;

    while (true) {
        const team_code = generateTeamCode(5);

        const { data, error } = await TeamRepository.createTeam({
            event_id: eventId,
            team_name: teamName,
            team_code,
        });

        if (error) {
            if (error.code === "23505") {
                console.warn("Duplicate team_code");
                continue;
            }
            throw new Error(`Failed to create team: ${error.message}`);
        }

        teamData = data;
        break;
    }

    if (!teamData) {
        throw new Error("Failed to create team.");
    }

    const { error: memberError } = await TeamRepository.addMember({
        team_id: teamData.team_id,
        attendee_id: attendeeData.attendee_id,
    });

    if (memberError) {
        throw new Error(`Failed to add attendee to team: ${memberError.message}`);
    }

    return teamData;
};

export const joinTeamWithCode = async (eventId: string, userId: string, teamCode: string): Promise<Tables<"Team">> => {
    const attendeeData = await getAttendee(eventId, userId);
    if (!attendeeData) {
        throw new Error("Attendee not found for this event and user.");
    }

    const existingTeam = await TeamRepository.getTeamByAttendee(attendeeData.attendee_id);
    if (existingTeam.data) {
        throw new Error("User is already in a team for this event.");
    }

    const { data: teamData, error: teamError } = await TeamRepository.getTeamByCode(eventId, teamCode);

    if (teamError || !teamData) {
        throw new Error("Team with the provided code not found.");
    }

    const { error: memberError } = await TeamRepository.addMember({
        team_id: teamData.team_id,
        attendee_id: attendeeData.attendee_id,
    });

    if (memberError) {
        throw new Error(`Failed to add attendee to team: ${memberError.message}`);
    }

    return teamData;
};

export const leaveUserTeam = async (eventId: string, userId: string): Promise<{ message: string }> => {
    const attendeeData = await getAttendee(eventId, userId);
    if (!attendeeData) {
        throw new Error("Attendee not found for this event and user.");
    }

    const { data: teamData, error: teamError } = await TeamRepository.getTeamByAttendee(attendeeData.attendee_id);

    if (teamError || !teamData) {
        throw new Error("User is not in a team for this event.");
    }

    const { error: removeError } = await TeamRepository.removeMember(teamData.team_id, attendeeData.attendee_id);

    if (removeError) {
        throw new Error(`Failed to remove attendee from team: ${removeError.message}`);
    }

    return { message: "Successfully left the team." };
};
