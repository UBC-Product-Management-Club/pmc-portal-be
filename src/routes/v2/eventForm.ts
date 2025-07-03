import {Router} from "express";
import {getEventForm} from "../../services/eventForm/get";
import {ZodError} from "zod";
import {addEventForm} from "../../services/eventForm/add";

export const eventFormRouter = Router()

eventFormRouter.get('/:id', async (req, res) => {
    try {
        //const form = await getSupabaseEventForm(req.params.id);
        res.status(200).json({message: `supabase getForm ${req.params.id}` });
    } catch (error: any) {
        res.status(500).json({error: error.message});
    }
});

eventFormRouter.post('/addEventForm', async (req, res) => {
    try {
        //await addSupabaseEventForm(req.body);
        res.status(201).json({
            message: `Supabase Form has been created successfully.`,
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