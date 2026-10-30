import { Json } from "../../schema/v2/database.types";
import { TeamRepository } from "../../storage/TeamRepository";
import { DatabaseErrors, rpcResult } from "../ApiError";

const TEAM_ERRORS: DatabaseErrors = {
  NOT_REGISTERED: [403, "Only registered students can join teams."],
  NOT_ON_TEAM: [404, "You're not on a team for this event."],
  ALREADY_ON_TEAM: [409, "You're already on a team."],
  NOT_FOUND: [404, "No team has that code."],
  TEAM_FULL: [409, "That team is already full."],
  ROSTER_LOCKED: [409, "This team has already submitted, so its members can't change."],
  CLOSED: [403, "The deadline has passed, so this team can no longer change."],
  TEAM_NAME_TAKEN: [409, "Another team already has that name.", undefined, { team_name: "That name is taken." }],
  INVALID_TEAM_NAME: [400, "Team names must be 1 to 80 characters.", "VALIDATION_ERROR", { team_name: "Use 1 to 80 characters." }],
};

export const getUserTeam = (eventId: string, userId: string) => rpcResult<Json>(TeamRepository.myTeam(eventId, userId), TEAM_ERRORS);

export const createUserTeam = (eventId: string, userId: string, teamName: string) =>
  rpcResult<Json>(TeamRepository.createTeam(eventId, userId, teamName), TEAM_ERRORS);

export const joinTeamWithCode = (eventId: string, userId: string, teamCode: string) =>
  rpcResult<Json>(TeamRepository.joinTeam(eventId, userId, teamCode), TEAM_ERRORS);

export const renameUserTeam = (eventId: string, userId: string, teamName: string) =>
  rpcResult<Json>(TeamRepository.renameTeam(eventId, userId, teamName), TEAM_ERRORS);

export const leaveUserTeam = async (eventId: string, userId: string) => {
  await rpcResult(TeamRepository.leaveTeam(eventId, userId), TEAM_ERRORS);
};
