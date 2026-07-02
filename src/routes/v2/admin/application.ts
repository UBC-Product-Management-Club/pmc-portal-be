import { Request, Response, Router } from "express";
import { ApplicationStatusUpdateSchema } from "../../../schema/v2/Application";
import {
    getApplication,
    listApplications,
    updateApplicationStatus,
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

// Update an applicant's status. Invalid statuses are rejected by the schema.
applicationRouter.patch("/:id/status", async (req: Request, res: Response) => {
    const result = ApplicationStatusUpdateSchema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({ error: result.error.message });
    }

    try {
        const application = await updateApplicationStatus(
            req.params.id,
            result.data.status
        );
        if (!application) {
            return res.status(404).json({ error: "Application not found" });
        }
        return res.status(200).json(application);
    } catch (error: any) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }
});
