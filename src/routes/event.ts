import { Router } from "express";
import { getEvents, getEventById } from "../controllers/events/event";

export const eventRouter = Router();

eventRouter.get("/", async (req, res) => {
  try {
    const events = await getEvents();
    res.status(200).json(events);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

eventRouter.get("/:id", async (req, res) => {
  try {
    const eventByID = await getEventById(req.params.id);
    res.status(200).json(eventByID);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
