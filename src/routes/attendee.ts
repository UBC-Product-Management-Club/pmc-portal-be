import { Router } from "express";
import { getAttendeeById } from "../services/events/attendee";
import { getEventById } from "../services/events/event";
import { Attendee } from "../schema/Event";
import { db } from "../config/firebase";
import { FieldValue } from "firebase-admin/firestore";
import { checkEmail } from "../services/qrCode";

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

attendeeRouter.get('/:eventId/:email/qr', async (req, res) => {
  try {
    const event = await getEventById(req.params.eventId);
    const attendeeId = await checkEmail(req.params.email, req.params.eventId);
    if (!attendeeId) {
      return res.status(404).send({
        message: "Attendee with this email is not found."
      });
    }
    const attendee = await getAttendeeById(attendeeId);

    if (!event) {
      return res.status(404).send({
        message: "Event not found"
      });
    }
    if (!attendee) {
      return res.status(404).send({
        message: "Attendee with this email is not found."
      });
    }

    res.status(200).json({
      message: "Successfully retrieved points",
      totalPoints: attendee.points
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
})

// updating the points for the attendee
attendeeRouter.put('/:eventId/:email/qr/:qrCodeId', async (req, res) => {
  try {
    const event = await getEventById(req.params.eventId);
    const attendeeId = await checkEmail(req.params.email, req.params.eventId);
    if (!attendeeId) {
      return res.status(400).json({
        message: "Attendee with this email is not found."
      });
    }
    const attendee = await getAttendeeById(attendeeId);
    const qrCodeId = req.params.qrCodeId;

    if (!event) {
      return res.status(400).json({
        message: "Event not found"
      });
    }
    if (!attendee) {
      return res.status(400).json({
        message: "Attendee with this email is not found."
      });
    }

    const activities_attended = attendee.activities_attended;

    if (activities_attended.includes(qrCodeId)) {
      return res.status(400).json({
        message: "You have already scanned this QR code."
      });
    }
    
    const qrPoints = event.points[qrCodeId];
    const attendeeRef = db.collection('attendees').doc(attendeeId);

    activities_attended.push(qrCodeId);

    await attendeeRef.update({
      points: FieldValue.increment(qrPoints),
      activities_attended
    });

    // Retrieve updated attendee data
    const updatedAttendee = await getAttendeeById(attendeeId);

    res.status(200).json({
      message: "Successfully added points",
      totalPoints: updatedAttendee!.points
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});
