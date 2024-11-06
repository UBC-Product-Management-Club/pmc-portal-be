import {Router} from "express";
import {getEventForm} from "../controllers/eventForm/get";


export const eventFormRouter = Router()

eventFormRouter.get('/:id', async (req, res) => {
    try {
        const form = await getEventForm(req.params.id);
        res.status(200).json(form);
    } catch (error: any) {
        res.status(500).json({error: error.message});
    }
});