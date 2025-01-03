import { Router } from "express";
import { getAttendeeById } from "../controllers/events/attendee";
import { getEventById } from "../controllers/events/event";
import { Attendee } from "../schema/Event";

export const attendeeRouter = Router();

attendeeRouter.get("/:eventId", async (req, res) => {
  try {
    const { eventId } = req.params;
    
    if (!eventId) {
      return res.status(400).json({ error: "Missing event ID" });
    }

    const event = await getEventById(eventId);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    const attendeeList: Attendee[] = [];

    for (const attendeeId of event.attendee_Ids) {
      const attendee = await getAttendeeById(attendeeId);

      if (attendee) {
        attendeeList.push(attendee);
      }
    }

    res.status(200).json(attendeeList);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
