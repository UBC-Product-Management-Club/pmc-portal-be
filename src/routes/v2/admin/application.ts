import { Request, Response, Router } from "express";
import {
    getApplication,
    listApplications,
} from "../../../services/Application/ApplicationService";

export const applicationRouter = Router();

applicationRouter.get("/", async (req: Request, res: Response) => {
    try {
        const applications = await listApplications();
        return res.status(200).json(applications);
    } catch (error: any) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }
});

applicationRouter.get("/:id", async (req: Request, res: Response) => {
    try {
        const application = await getApplication(req.params.id);
        if (!application) {
            return res.status(404).json({ error: "Application not found" });
        }
        return res.status(200).json(application);
    } catch (error: any) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }
});
