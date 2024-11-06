import {getEvents} from "../controllers/events/event";
import {Router} from "express";


export const eventFormRouter = Router()

eventFormRouter.get('/', async (req, res) => {
    try {
        const events = await getEvents();
        res.status(200).json(events);
    } catch (error: any) {
        res.status(500).json({error: error.message});
    }
});