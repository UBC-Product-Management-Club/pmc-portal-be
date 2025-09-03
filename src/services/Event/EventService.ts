import _ from "lodash";
import { supabase } from "../../config/supabase";
import { Tables } from "../../schema/v2/database.types";
import { EventInsert } from "../../schema/v2/Event";

export const getEvents = async (): Promise<Partial<Tables<'Event'>>[]> => {
    const {data, error} = await supabase.from('Event')
        .select("event_id, name, description, date, start_time, end_time, location, member_price, non_member_price, thumbnail, is_disabled")
        .order("date", { ascending: false })
    if (error || !data) {
        console.error("Error fetching events: ", error);
        throw new Error('Failed to fetch events: ' + error?.message);
    }
    return data;
};

export const getEvent = async (id: string): Promise<Tables<'Event'> & { registered: number } | null> => {
    const { data, error: fetchEventError } = await supabase.from('Event').select('*, Attendee(count)').eq('event_id', id).maybeSingle();

    if (fetchEventError) {
        console.error("Error fetching event: ", fetchEventError);
        throw new Error(`Failed to fetch event ${id}: ` + fetchEventError?.message);
    }

    if (!data) return null

    return {..._.omit(data, "Attendee"), registered: data.Attendee[0].count}
};

export const getRegisteredEvents = async (userId: string) => {
    const { data, error } = await supabase
        .from("Attendee")
        .select(`
            Event!inner (
            event_id,
            name,
            description,
            date,
            start_time,
            end_time,
            location,
            member_price,
            non_member_price,
            thumbnail,
            is_disabled
            )
        `)
        .eq("user_id", userId)
        .gte("Event.end_time", new Date().toISOString())
        .order("date", { referencedTable: "Event", ascending: false }); 

    if (error) throw error

    return data;
};

// Retrieves event price id
export const getEventPriceId = async (eventId: string, isMember: boolean) => {
    const selectCondition = isMember ? "member_price_id" : "non_member_price_id";

    const { data, error } = await supabase
        .from("Event")
        .select(selectCondition)
        .eq("event_id", eventId)
        .single();

    if (!data) throw new Error("Event not found");
    if (error) throw error;

    return (data as Record<string, string>)[selectCondition];
};

// WIP (need to be adjusted to call stripe api to generate price ID) [JEFF]
export const addEvent = async (event: EventInsert): Promise<void> => {
    const { date, start_time, end_time } = event;

    // Should never trigger if controller properly validates the fields
    if (!date || !start_time || !end_time) {
        throw new Error("Missing required fields.");
    }

    const dateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
    const isoTimestampRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})?$/;
    
    if (!dateRegex.test(date)) {
        console.log("Date from form:", date);
        throw new Error("Event date invalid. Must be ISO format (YYYY-MM-DD).")
    }

    if (!isoTimestampRegex.test(start_time)) {
        throw new Error("Start time invalid. Must be ISO format (Thh:mm:ss).")
    }

    if (!isoTimestampRegex.test(end_time)) {
        throw new Error("End time invalid. Must be ISO format (Thh:mm:ss).")
    }

    const { error } = await supabase.from('Event').insert(event)
        if (error) {
        throw new Error("Failed to insert event due to unexpected error: " + error.message);
    } 

}

export const isFull = async (eventId: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from('Event')
      .select(`
        max_attendees,
        attendees:Attendees!inner(event_id)
      `)
      .eq('event_id', eventId)
      .single();
  
    if (error) throw error;
    if (!data || data.max_attendees == null) throw new Error("Event not found or max_attendees missing");
  
    // Count the attendees
    const registeredCount = data.attendees?.length ?? 0;
  
    return registeredCount >= data.max_attendees;
  };