import { Router } from "express";
import { handleEvent } from "../controllers/dashboard/event";
import { handleEvents } from "../controllers/dashboard/events";


const eventsRouter = Router()

eventsRouter.get('/events', handleEvents)
eventsRouter.get('/event/:id', handleEvent)

export { eventsRouter }