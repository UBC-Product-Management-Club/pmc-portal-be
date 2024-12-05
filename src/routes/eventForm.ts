import {Router} from "express";
import {getEventForm} from "../controllers/eventForm/get";
import {ZodError} from "zod";
import {addEventForm} from "../controllers/eventForm/add";

export const eventFormRouter = Router()

eventFormRouter.get('/:id', async (req, res) => {
    try {
        const form = await getEventForm(req.params.id);
        res.status(200).json(form);
    } catch (error: any) {
        res.status(500).json({error: error.message});
    }
});

eventFormRouter.post('/addEventForm', async (req, res) => {
    try {
        await addEventForm(req.body);
        res.status(201).json({
            message: `Form has been created successfully.`,
        });
    } catch (error: any) {
        if (typeof (error) == typeof (ZodError))
            res.status(400).json({
                error: "Invalid request body.\n" + error.message
            });
        else
            res.status(500).json({error: error.message})
    }
});