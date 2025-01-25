import { Router } from "express";
import { getAttendeeById } from "../controllers/events/attendee";
import { getEventById } from "../controllers/events/event";
import { Attendee } from "../schema/Event";
import { db } from "../config/firebase";
import { FieldValue } from "firebase-admin/firestore";

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

// updating the points for the attendee
attendeeRouter.put('/:eventId/:attendeeId/qr/:qrCodeId', async (req, res) => {
  try {
    const event = await getEventById(req.params.eventId);
    const attendee = await getAttendeeById(req.params.attendeeId);
    const qrCodeId = req.params.qrCodeId; // get from frontend

    if (!event) {
      return res.status(404).send("Event not found");
    }
    if (!attendee) {
      return res.status(404).send("User not found");
    }

    // checks if user has scanned the qr code or not
    const activities_attended = attendee.activities_attended;

    if (activities_attended.includes(qrCodeId)) {
      return res.status(400).send("You have already scanned this QR code.")
    }
    const qrPoints = event.points[qrCodeId];
    const attendeeRef = db.collection('attendees').doc(req.params.attendeeId);

    activities_attended.push(qrCodeId);

    await attendeeRef.update({
      points: FieldValue.increment(qrPoints),
      activities_attended
    });

    res.status(200).send("Successfully added points");
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});