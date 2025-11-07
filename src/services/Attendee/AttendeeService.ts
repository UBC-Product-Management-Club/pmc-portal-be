import { Tables, TablesInsert } from "../../schema/v2/database.types";
import { AttendeeRepository } from "../../storage/AttendeeRepository";
import { EventInformation } from "../Event/EventService";

type Attendee = TablesInsert<"Attendee">

export const addAttendee = async (event: EventInformation, registrationData: Attendee): Promise<Tables<"Attendee">> => {
    const attendee = await createAttendee(event, registrationData);
    const { data, error } = await AttendeeRepository.addAttendee(attendee)
    if (error) {
        throw new Error(`Failed to create attendee: ${error.message}`);
    }
    
    return data
}

export const getAttendee = async (eventId: string, userId: string): Promise<Tables<"Attendee"> | null> => {
    const { data: attendee, error } = await AttendeeRepository.getAttendee(eventId, userId)
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

    return {message: `deleted attendee ${attendeeId}`};
}

export const createAttendee = async (event: EventInformation, registrationData: Attendee) : Promise<Attendee> => {
    const { user_id, event_id } = registrationData;
    
    if (!user_id || !event_id) {
        throw new Error("Missing required fields")
    }
    
    if (event.max_attendees === event.registered) {
        throw new Error(`Event ${event_id} is full!`)
    }

    if ((await AttendeeRepository.getRegisteredAttendee(event_id, user_id)).data) {
        throw new Error(`User already registered for event`)
    }

    return {
        ...registrationData, 
        status: event.needs_review ? 'APPLIED' : 'PROCESSING',
    }
}
