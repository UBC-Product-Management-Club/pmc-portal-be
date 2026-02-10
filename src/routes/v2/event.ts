import { Request, Response, Router } from "express";
import { authenticated } from "../../middleware/Session";
import { Database } from "../../schema/v2/database.types";
import {
  addAttendee,
  getAttendee,
} from "../../services/Attendee/AttendeeService";
import {
  getEvent,
  getEventDeliverableFlags,
  getEvents,
  getRegisteredEvents
} from "../../services/Event/EventService";
import {
  createUserTeam,
  getUserTeam,
  joinTeamWithCode,
  leaveUserTeam,
} from "../../services/Team/TeamService";

import multer from "multer";
import { DraftService } from "../../services/Drafts/DraftService";
import { LoopsEvent, sendEmail } from "../../services/Email/EmailService";
import {
  getDeliverable,
  uploadDeliverableFiles,
  uploadSupabaseFiles,
} from "../../storage/Storage";

type AttendeeInsert = Database["public"]["Tables"]["Attendee"]["Insert"];

export const eventRouter = Router();

const memStorage = multer.memoryStorage();
const upload = multer({ storage: memStorage });

eventRouter.get("/", ...authenticated, async (req, res) => {
  try {
    const events = await getEvents();
    res.status(200).json(events);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

eventRouter.get("/:id", async (req, res) => {
  try {
    const eventByID = await getEvent(req.params.id);
    res.status(200).json(eventByID);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

eventRouter.get("/events/registered", ...authenticated, async (req, res) => {
  const userId = req.user?.user_id;
  if (!userId) return res.status(400).json({ error: "User ID is required!" });

  try {
    const userCurrentEvents = await getRegisteredEvents(userId);
    return res.status(200).json(userCurrentEvents);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

eventRouter.get(
  "/:eventId/attendee",
  ...authenticated,
  async (req: Request, res: Response) => {
    const userId = req.user?.user_id;
    const eventId = req.params.eventId;
    if (!userId) return res.status(400).json({ error: "User ID required!" });
    try {
      const attendee = await getAttendee(eventId, userId);
      return res.status(200).json(attendee);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
);

// Adds event attendee (payment not verified, payment id set to null)
eventRouter.post(
  "/:eventId/register",
  ...authenticated,
  upload.any(),
  async (req: Request, res: Response) => {
    const userId = req.user?.user_id;
    const eventId = req.params.eventId;
    if (!userId)
      return res.status(401).json({ error: "User not authenticated" });

    try {
      const event = await getEvent(eventId);

      if (!event) {
        throw new Error(`Failed to fetch event ${eventId}`);
      }

      const files = req.files as Express.Multer.File[];
      const bucketName = process.env.SUPABASE_ATTENDEE_BUCKET_NAME!;
      const parentPath = `attendee/${eventId}/`;

      const fileRefs = await uploadSupabaseFiles(files, {
        parentPath,
        bucketName,
        isPublic: false,
      });
      const eventFormAnswers = Object.assign(req.body, fileRefs);

      const insertData: AttendeeInsert = {
        user_id: userId,
        event_id: eventId,
        payment_id: null,
        is_payment_verified: false,
        event_form_answers: eventFormAnswers,
      };

      const result = await addAttendee(event, insertData);
      sendEmail(userId, LoopsEvent.ApplicationReceived, {
        event_name: event.name!,
      });
      res.status(201).json({
        message: "Registration successful",
        attendee: result,
      });
    } catch (error: any) {
      console.error(error);
      res.status(500).json(error);
    }
  }
);

eventRouter.get("/drafts/:eventId", ...authenticated, async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user?.user_id;

    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ error: "userId is required" });
    }

    const draftService = new DraftService();
    const draft = await draftService.loadDraft(eventId, userId);

    res.status(200).json(draft);
  } catch (error: any) {
    console.error("Error loading draft:", error);
    res.status(500).json({ error: error.message });
  }
});

eventRouter.post("/drafts/:eventId", ...authenticated, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { draft } = req.body;

    const userId = req.user?.user_id;

    if (!userId || !draft) {
      return res.status(400).json({ error: "userId and draft are required" });
    }

    const draftService = new DraftService();
    const savedDraft = await draftService.saveDraft(eventId, userId, draft);

    res.status(200).json(savedDraft);
  } catch (error: any) {
    console.error("Error saving draft:", error);
    res.status(500).json({ error: error.message });
  }
});

eventRouter.delete("/drafts/:eventId", ...authenticated, async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user?.user_id;

    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ error: "userId is required" });
    }

    const draftService = new DraftService();
    await draftService.deleteDraft(eventId, userId);

    res.status(204).send();
  } catch (error: any) {
    console.error("Error deleting draft:", error);
    res.status(500).json({ error: error.message });
  }
});

// submit deliverables for team member
eventRouter.post(
  "/:eventId/deliverable",
  ...authenticated,
  upload.any(),
  async (req: Request, res: Response) => {
    const userId = req.user?.user_id;
    const eventId = req.params.eventId;
    const files = req.files as Express.Multer.File[];
    const formData = req.body;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    try {
      const result = await uploadDeliverableFiles(
        files,
        userId,
        eventId,
        formData
      );

      res.status(201).json({
        message: "Deliverables submitted successfully",
        data: result,
      });
    } catch (error: any) {
      console.error("Deliverable upload error:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

eventRouter.get(
  "/:eventId/deliverable",
  ...authenticated,
  async (req: Request, res: Response) => {
    const userId = req.user?.user_id;
    const eventId = req.params.eventId;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    if (!eventId) {
      return res.status(400).json({ error: "Event ID is required" });
    }

    try {
      const result = await getDeliverable(userId, eventId);

      res.status(200).json(result);
    } catch (error: any) {
      console.error("Fetch deliverable error:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

eventRouter.get(
  "/:eventId/team",
  ...authenticated,
  async (req: Request, res: Response) => {
    const userId = req.user?.user_id;
    const eventId = req.params.eventId;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    try {
      const team = await getUserTeam(eventId, userId);
      return res.status(200).json(team);
    } catch (error: any) {
      console.error("Fetch team error:", error);
      return res.status(500).json({ error: error.message });
    }
  }
);

eventRouter.post(
  "/:eventId/team",
  ...authenticated,
  async (req: Request, res: Response) => {
    const userId = req.user?.user_id;
    const eventId = req.params.eventId;
    const { team_name } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    if (!team_name || typeof team_name !== "string") {
      return res.status(400).json({ error: "team_name is required" });
    }

    try {
      const team = await createUserTeam(eventId, userId, team_name);
      return res.status(201).json(team);
    } catch (error: any) {
      if (error.code === "23505") {
        const msg = error.message || "";

        if (msg.includes("Team_event_id_team_name_idx")) {
          return res.status(409).json({
            error: "A team with that name already exists in this event.",
          });
        }

        if (msg.includes("Team_Member_pkey")) {
          return res
            .status(409)
            .json({ error: "User is already in a team for this event." });
        }

        return res
          .status(409)
          .json({ error: "Duplicate value violates a unique rule." });
      }
      return res.status(500).json({ error: error.message });
    }
  }
);

eventRouter.post(
  "/:eventId/team/join",
  ...authenticated,
  async (req: Request, res: Response) => {
    const userId = req.user?.user_id;
    const eventId = req.params.eventId;
    const { team_code } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    if (!team_code || typeof team_code !== "string") {
      return res.status(400).json({ error: "team_code is required" });
    }

    try {
      const team = await joinTeamWithCode(eventId, userId, team_code);
      return res.status(200).json(team);
    } catch (error: any) {
      console.error("Join team error:", error);
      return res.status(500).json({ error: error.message });
    }
  }
);

eventRouter.delete(
  "/:eventId/team",
  ...authenticated,
  async (req: Request, res: Response) => {
    const userId = req.user?.user_id;
    const eventId = req.params.eventId;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    try {
      await leaveUserTeam(eventId, userId);
      return res.status(200).json({ message: "Left team successfully" });
    } catch (error: any) {
      console.error("Leave team error:", error);
      return res.status(500).json({ error: error.message });
    }
  }
);

eventRouter.get(
  "/:eventId/flags",
  ...authenticated,
  async (req: Request, res: Response) => {
    const userId = req.user?.user_id;
    const eventId = req.params.eventId;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    try {
      const deliverables = await getEventDeliverableFlags(eventId);
      return res.status(200).json(deliverables);
    } catch (error: any) {
      console.error("Get event deliverable error:", error);
      return res.status(500).json({ error: error.message });
    }
  }
)
