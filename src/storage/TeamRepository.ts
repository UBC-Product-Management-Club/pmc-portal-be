import { supabase } from "../config/supabase";

// Every team change is one database function that checks the rules and writes
// in the same transaction (20261029000000_team_rules.sql). Each returns the team
// as students see it.
export const TeamRepository = {
    myTeam: (eventId: string, userId: string) => supabase.rpc("my_team", { p_event_id: eventId, p_user_id: userId }),
    createTeam: (eventId: string, userId: string, teamName: string) =>
        supabase.rpc("create_team", { p_event_id: eventId, p_user_id: userId, p_team_name: teamName }),
    joinTeam: (eventId: string, userId: string, teamCode: string) =>
        supabase.rpc("join_team", { p_event_id: eventId, p_user_id: userId, p_team_code: teamCode }),
    leaveTeam: (eventId: string, userId: string) => supabase.rpc("leave_team", { p_event_id: eventId, p_user_id: userId }),
    renameTeam: (eventId: string, userId: string, teamName: string) =>
        supabase.rpc("rename_team", { p_event_id: eventId, p_user_id: userId, p_team_name: teamName }),
    getTeamByAttendee: (attendeeId: string) =>
        supabase
            .from("Team_Member")
            .select(
                `
        team_id,
        Team (
          team_name,
          team_code,
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
