import { Request, Response, Router } from "express";
import { ApplicationSubmissionSchema } from "../../schema/v2/Application";
import {
    getApplicationByUser,
    submitApplication,
} from "../../services/Application/ApplicationService";

export const applicationRouter = Router();

// Submit an application for the authenticated applicant.
applicationRouter.post("/", async (req: Request, res: Response) => {
    const userId = req.user?.user_id;
    if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
    }

    const result = ApplicationSubmissionSchema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({ error: result.error.message });
    }

    try {
        const application = await submitApplication(
            userId,
            result.data.application_data
        );
        return res.status(201).json(application);
    } catch (error: any) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }
});

// Retrieve the authenticated applicant's own submission.
applicationRouter.get("/me", async (req: Request, res: Response) => {
    const userId = req.user?.user_id;
    if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
    }

    try {
        const application = await getApplicationByUser(userId);
        if (!application) {
            return res.status(404).json({ error: "Application not found" });
        }
        return res.status(200).json(application);
    } catch (error: any) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }
});
