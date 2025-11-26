import { supabase } from "../config/supabase";
import { TablesInsert } from "../schema/v2/database.types";

type Team = TablesInsert<"Team">;
type TeamMember = TablesInsert<"Team_Member">;

export const TeamRepository = {
    createTeam: (team: Team) => supabase.from("Team").insert(team).select().single(),
    getTeamById: (teamId: string) => supabase.from("Team").select("*").eq("team_id", teamId).single(),
    getTeamByCode: (eventId: string, code: string) => supabase.from("Team").select("*").eq("event_id", eventId).eq("team_code", code).single(),
    getTeamsByEvent: (eventId: string) => supabase.from("Team").select("*").eq("event_id", eventId),
    updateTeam: (teamId: string, updates: Record<string, any>) => supabase.from("Team").update(updates).eq("team_id", teamId),
    deleteTeam: (teamId: string) => supabase.from("Team").delete().eq("team_id", teamId),
    addMember: (member: TeamMember) => supabase.from("Team_Member").insert(member).select().single(),
    removeMember: (teamId: string, attendeeId: string) => supabase.from("Team_Member").delete().eq("team_id", teamId).eq("attendee_id", attendeeId),
    getTeamWithMembers: (teamId: string) =>
        supabase
            .from("Team")
            .select(
                `
        team_id,
        event_id,
        team_name,
        Team_Member (
          attendee_id,
          Attendee (
            user_id,
            User (
              first_name,
              last_name,
              email
            )
          )
        )
      `
            )
            .eq("team_id", teamId)
            .single(),
    getTeamByAttendee: (attendeeId: string) =>
        supabase
            .from("Team_Member")
            .select(
                `
        team_id,
        Team (
          team_name,
          Team_Member (
            attendee_id,
            Attendee (
              user_id,
              User (
                first_name,
                last_name,
                email
              )
            )
          )
        )
      `
            )
            .eq("attendee_id", attendeeId)
            .single(),
};
