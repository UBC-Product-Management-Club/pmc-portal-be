import { Router } from "express";
import { getAttendeeById } from "../controllers/events/attendee";

export const attendeeRouter = Router();

attendeeRouter.get("/:id", async (req, res) => {
  try {
    const attendeeById = await getAttendeeById(req.params.id);
    res.status(200).json(attendeeById);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

attendeeRouter.get("/:eventId", async (req, res) => {
  try {
    const { eventId } = req.params;
    if (!eventId) {
      return res.status(400).json({ error: "Missing event ID" });
    }
    const attendee = await getAttendeeById(eventId);
    res.status(200).json(attendee);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});