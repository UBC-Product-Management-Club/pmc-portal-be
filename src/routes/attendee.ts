import { Router } from "express";
import { getAttendeeById, addAttendee } from "../controllers/events/attendee";
import { Attendee } from "../schema/Event";
import { v4 as uuidv4 } from "uuid";

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

attendeeRouter.post("/addAttendee", async (req, res) => {
  const attendee_Id = uuidv4(); // might create a new field in the collection
  const requiredFields = [
    "is_member",
    "event_Id",
    "first_name",
    "last_name",
    "email",
    "ubc_student",
    "familiarity",
    "found_out",
    "dietary",
  ];
  // need to figure how to pass in event ID and member ID dynamically?
  // so when users click register, it sends their current member ID (through session) and the event ID it clicked
  if (
    req.body["ubc_student"] == "yes" ||
    req.body["ubc_student"] == "no, other uni"
  ) {
    requiredFields.push("year", "faculty", "major");
  }

  if (req.body["ubc_student"] == "yes") {
    requiredFields.push("student_id");
  }

  for (const field of requiredFields) {
    if (!req.body.hasOwnProperty(field)) {
      console.error(`Missing required field: ${field}`);
      return res
        .status(400)
        .json({ error: `Missing required field: ${field}` });
    }
  }
  const newAttendee: Attendee = { attendee_Id, ...req.body };

  try {
    await addAttendee(newAttendee);
    res.status(201).json({
      message: `Attendee with ID ${attendee_Id} has been created successfully.`,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
