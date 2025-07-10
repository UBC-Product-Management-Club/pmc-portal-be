import {EventFormSchema} from "../../schema/v1/EventForm";
import {db} from "../../config/firebase";

export const addEventForm = async (data: object): Promise<void> => {
    const parsedData = EventFormSchema.parse(data);
    await db.collection("eventForms").add(parsedData);
}