import { Request, Response, Router } from "express";
import {
    getActiveCycle,
    getApplicationForm,
    getRolesForCycle,
} from "../../services/Application/ApplicationService";

// Shared error mapping, so every route turns the same service error into the
// same status code.
const handleApplicationError = (error: any, res: Response) => {
    console.error(error);
    return res.status(500).json({ error: error.message });
};

export const applicationRouter = Router();

// Public: whether hiring is open and which roles can be applied to. Drives both
// the portal's "apply" button and the role picker shown before the form.
applicationRouter.get("/cycle", async (_req: Request, res: Response) => {
    try {
        const cycle = await getActiveCycle();
        if (!cycle) {
            return res.status(200).json({ open: false, cycle: null, roles: [] });
        }
        const roles = await getRolesForCycle(cycle.cycle_id);
        return res.status(200).json({ open: true, cycle, roles });
    } catch (error) {
        return handleApplicationError(error, res);
    }
});

// Public: the questions to render for one role -- the cycle's general questions
// plus that role's own, already in display order.
applicationRouter.get("/form/:roleId", async (req: Request, res: Response) => {
    try {
        const form = await getApplicationForm(req.params.roleId);
        if (!form) {
            return res.status(404).json({ error: "Application form not found" });
        }
        return res.status(200).json(form);
    } catch (error) {
        return handleApplicationError(error, res);
    }
});
