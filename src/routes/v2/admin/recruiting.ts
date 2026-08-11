import { Request, Response, Router } from "express";
import { z } from "zod/v4";
import { requireVP } from "../../../middleware/Session";
import {
    ApplicationListQuerySchema,
    ApplicationNotesUpdateSchema,
    ApplicationStatusUpdateSchema,
} from "../../../schema/v2/Application";
import {
    ApplicationNotFoundError,
    ForbiddenError,
    InvalidStatusTransitionError,
    getAdminCycle,
    getApplicationDetail,
    listApplications,
    updateNotes,
    updateStatus,
} from "../../../services/Application/AdminApplicationService";

export const recruitingRouter = Router();

// Shared error mapping, mirroring the applicant-facing routes so both halves of
// the feature answer with the same shapes.
const handleAdminApplicationError = (error: any, res: Response) => {
    if (error instanceof ApplicationNotFoundError) {
        return res.status(404).json({ error: error.message });
    }
    if (error instanceof ForbiddenError) {
        return res.status(403).json({ error: error.message });
    }
    if (error instanceof InvalidStatusTransitionError) {
        return res.status(409).json({ error: error.message });
    }
    console.error(error);
    return res.status(500).json({ error: error.message });
};

const validationFailed = (res: Response, error: z.ZodError) => {
    const flattened = z.flattenError(error);
    return res.status(400).json({
        error: "Validation failed",
        fieldErrors: flattened.fieldErrors,
        formErrors: flattened.formErrors,
    });
};

// The cycle and its roles, for the viewer's filter dropdowns. Returns the cycle
// whether or not it is open -- execs review after it closes.
recruitingRouter.get("/cycle", async (_req: Request, res: Response) => {
    try {
        return res.status(200).json(await getAdminCycle());
    } catch (error) {
        return handleAdminApplicationError(error, res);
    }
});

recruitingRouter.get("/applications", async (req: Request, res: Response) => {
    const result = ApplicationListQuerySchema.safeParse(req.query);
    if (!result.success) {
        return validationFailed(res, result.error);
    }

    try {
        return res.status(200).json(await listApplications(result.data));
    } catch (error) {
        return handleAdminApplicationError(error, res);
    }
});

// Opening an application is what marks it reviewed, so this is not a pure read.
recruitingRouter.get(
    "/applications/:applicationId",
    async (req: Request, res: Response) => {
        try {
            return res
                .status(200)
                .json(await getApplicationDetail(req.params.applicationId));
        } catch (error) {
            return handleAdminApplicationError(error, res);
        }
    }
);

// Any allowlisted exec may leave referral notes; the service rejects general
// notes from anyone below VP.
recruitingRouter.patch(
    "/applications/:applicationId/notes",
    async (req: Request, res: Response) => {
        const result = ApplicationNotesUpdateSchema.safeParse(req.body);
        if (!result.success) {
            return validationFailed(res, result.error);
        }

        const role = req.admin?.role;
        if (!role) {
            return res.status(500).json({ error: "Authorization is misconfigured" });
        }

        try {
            const application = await updateNotes(
                req.params.applicationId,
                role,
                result.data
            );
            return res.status(200).json(application);
        } catch (error) {
            return handleAdminApplicationError(error, res);
        }
    }
);

recruitingRouter.patch(
    "/applications/:applicationId/status",
    requireVP,
    async (req: Request, res: Response) => {
        const result = ApplicationStatusUpdateSchema.safeParse(req.body);
        if (!result.success) {
            return validationFailed(res, result.error);
        }

        try {
            const application = await updateStatus(
                req.params.applicationId,
                result.data.status
            );
            return res.status(200).json(application);
        } catch (error) {
            return handleAdminApplicationError(error, res);
        }
    }
);
