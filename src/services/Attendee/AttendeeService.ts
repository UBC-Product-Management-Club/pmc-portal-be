import { Database, Tables, TablesInsert } from "../../schema/v2/database.types";
import { AttendeeRepository } from "../../storage/AttendeeRepository";
import { getEvent } from "../Event/EventService";

type Attendee = TablesInsert<"Attendee">

// Adds correctly 
export const addAttendee = async (registrationData: Attendee): Promise<Tables<"Attendee">> => {

    await checkValidAttendee(registrationData);

    const attendee: Attendee = {
        ...registrationData,
        registration_time: new Date().toISOString(),
        status: 'registered'
    }

    const { data, error } = await AttendeeRepository.addAttendee(attendee) 
    
    if (error) {
        throw new Error(`Failed to create attendee: ${error.message}`);
    }
    
    return data
}

// Returns attendee (not gurarenteed to be payment verified) [Ngl don't know why we need this still]
export const getAttendee = async (eventId: string, userId: string): Promise<Tables<"Attendee"> | null> => {
    const { data: attendee, error } = await AttendeeRepository.getAttendee(eventId, userId)
    if (error) {
        throw new Error(`Failed to check if user ${userId} is registered for event ${eventId}`)
    }
    return attendee
}

// Returns only registered and payment verified anttendees
export const getRegisteredAttendee = async (eventId: string, userId: string): Promise<Tables<"Attendee"> | null> => {
    const { data: attendee, error } = await AttendeeRepository.getRegisteredAttendee(eventId, userId)
    if (error) {
        throw new Error(`Failed to check if user ${userId} is registered for event ${eventId}`)
    }
    return attendee
}

export const deleteAttendee = async (attendeeId: string): Promise<{message: string}> => {
    const { error } = await AttendeeRepository.deleteAttendee(attendeeId)
    if (error) {
        throw new Error(`Failed to delete attendee ${attendeeId}: ${error.message}`) 
    }

    return {message: `deleting attendee ${attendeeId}`};
}

export const checkValidAttendee = async (registrationData: Attendee) => {
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
