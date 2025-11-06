import { supabase } from "../../config/supabase";
import { Database, Tables } from "../../schema/v2/database.types";
import { getEvent } from "../Event/EventService";

type AttendeeInsert = Database['public']['Tables']['Attendee']['Insert'];

// Adds correctly 
export const addAttendee = async (registrationData: AttendeeInsert): Promise<Tables<"Attendee">> => {

    await checkValidAttendee(registrationData);

    const attendee: AttendeeInsert = {
        ...registrationData,
        created_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
        .from('Attendee')
        .insert(attendee)
        .select()
        .single();
    
    if (error) {
        throw new Error(`Failed to create attendee: ${error.message}`);
    }
    
    return data
}

// Returns attendee (not gurarenteed to be payment verified) [Ngl don't know why we need this still]
export const getAttendee = async (eventId: string, userId: string): Promise<Tables<"Attendee"> | null> => {
    const { data: attendee, error } = await supabase.from("Attendee").select().eq('user_id', userId).eq('event_id', eventId).maybeSingle()
    if (error) {
        throw new Error(`Failed to check if user ${userId} is registered for event ${eventId}`)
    }
    return attendee
}

// Returns only registered and payment verified anttendees
export const getRegisteredAttendee = async (eventId: string, userId: string): Promise<Tables<"Attendee"> | null> => {
    const { data: attendee, error } = await supabase.from("Attendee").select().eq('user_id', userId).eq('event_id', eventId).or(`is_payment_verified.eq.true,status.eq.REGISTERED`).maybeSingle()
    if (error) {
        throw new Error(`Failed to check if user ${userId} is registered for event ${eventId}`)
    }
    return attendee
}

export const deleteAttendee = async (attendeeId: string): Promise<{message: string}> => {
    const { error } = await supabase.from("Attendee").delete().eq('attendee_id', attendeeId)
    if (error) {
        throw new Error(`Failed to delete attendee ${attendeeId}: ${error.message}`) 
    }

    return {message: `deleting attendee ${attendeeId}`};
}

export const checkValidAttendee = async (registrationData: AttendeeInsert) => {
    const { user_id, event_id } = registrationData;
    const event = await getEvent(event_id)
    
    if (!user_id || !event_id) {
        throw new Error("Missing required fields")
    }

    if (!event || event && Object.keys(event).length == 0) {
        throw new Error(`Event missing: ${event_id}`)
    }

    if (event.max_attendees === event.registered) {
        throw new Error(`Event ${event_id} is full!`)
    }

    if (await getRegisteredAttendee(event_id, user_id)) {
        throw new Error(`User already registered for event`)
    }
}


export const getTeam = async (attendee_id: string) => {
    const { data: teamData, error: teamIdError } = await supabase
        .from("Team_Member")
        .select('team_id')
        .eq('attendee_id', attendee_id)
        .single()
    if (!teamData) {
        throw new Error("No team found")
    }
    if (teamIdError) {
        throw new Error("Supabase error: " + teamIdError)
    }
    const team_id = teamData.team_id;
    const { data: teamNameData, error: teamError } = await supabase
        .from("Team")
        .select('team_name')
        .eq('team_id', team_id)
        .single()
        
    if (teamError) {
        throw new Error("Supabase error: " + teamError.message);
    }
    if (!teamNameData){ 
        throw new Error("Team not found"); 
    }
      const { data: members, error: membersError } = await supabase
        .from("Team_Member")
        .select(`
            attendee_id,
            Attendee (
                user_id,
                User (
                    first_name,
                    last_name,
                    email
                )
            )
        `)
        .eq("team_id", team_id);

    if (membersError) throw new Error("Supabase error: " + membersError.message);

    const teammates = members?.map((m) => ({
        attendee_id: m.attendee_id,
        user_id: m.Attendee?.user_id,
        name: m.Attendee?.User?.first_name +" " + m.Attendee?.User?.last_name,
        email: m.Attendee?.User?.email,
    })) ?? [];

    return {
        team_id,
        team_name: teamNameData.team_name,
        members: teammates,
    };
};

