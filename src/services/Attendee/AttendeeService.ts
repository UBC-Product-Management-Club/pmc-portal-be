import { supabase } from "../../config/supabase";
import { Database, Tables } from "../../schema/v2/database.types";
import { getEvent } from "../Event/EventService";

type AttendeeInsert = Database['public']['Tables']['Attendee']['Insert'];

// Adds correctly 
export const addAttendee = async (registrationData: AttendeeInsert): Promise<Tables<"Attendee">> => {

    await checkValidAttendee(registrationData);

    const attendee: AttendeeInsert = {
        ...registrationData,
        registration_time: new Date().toISOString(),
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


