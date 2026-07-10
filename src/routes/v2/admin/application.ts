import { Request, Response, Router } from "express";
import {
    ApplicationStarSchema,
    ApplicationStatusUpdateSchema,
} from "../../../schema/v2/Application";
import {
    listApplications,
    setApplicationStar,
    updateApplicationStatus,
    viewApplication,
} from "../../../services/Application/ApplicationService";

export const applicationRouter = Router();

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// application_id is a uuid column — reject malformed ids up front so Postgres
// doesn't turn them into "invalid input syntax" 500s.
const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// List submitted applications, most recent first. Supports ?limit & ?offset
// plus ?cycle=<cycle_id> to scope to one hiring cycle; returns
// { applications, total, limit, offset } so the dashboard can paginate.
applicationRouter.get("/", async (req: Request, res: Response) => {
    const parsedLimit = Number.parseInt(req.query.limit as string, 10);
    const parsedOffset = Number.parseInt(req.query.offset as string, 10);
    const limit = Number.isNaN(parsedLimit)
        ? DEFAULT_LIMIT
        : Math.min(Math.max(parsedLimit, 1), MAX_LIMIT);
    const offset = Number.isNaN(parsedOffset) ? 0 : Math.max(parsedOffset, 0);

    const cycle = req.query.cycle as string | undefined;
    if (cycle && !UUID_RE.test(cycle)) {
        return res.status(400).json({ error: "Invalid cycle id" });
    }

    try {
        const { applications, total } = await listApplications(
            limit,
            offset,
            cycle
        );
        return res.status(200).json({ applications, total, limit, offset });
    } catch (error: any) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }
});

// Viewing an application marks it UNDER_REVIEW the first time it is opened.
applicationRouter.get("/:id", async (req: Request, res: Response) => {
    if (!UUID_RE.test(req.params.id)) {
        return res.status(404).json({ error: "Application not found" });
    }
    try {
        const application = await viewApplication(req.params.id);
        if (!application) {
            return res.status(404).json({ error: "Application not found" });
        }
        return res.status(200).json(application);
    } catch (error: any) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }
});

// Flag/unflag a standout applicant ("people we want").
applicationRouter.patch("/:id/star", async (req: Request, res: Response) => {
    if (!UUID_RE.test(req.params.id)) {
        return res.status(404).json({ error: "Application not found" });
    }
    const result = ApplicationStarSchema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({ error: result.error.message });
    }

    try {
        const application = await setApplicationStar(
            req.params.id,
            result.data.is_starred
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

// Update an applicant's status. Invalid statuses are rejected by the schema.
applicationRouter.patch("/:id/status", async (req: Request, res: Response) => {
    if (!UUID_RE.test(req.params.id)) {
        return res.status(404).json({ error: "Application not found" });
    }
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
