import { NextFunction, Request, Response, Router } from "express";
import multer from "multer";
import { z } from "zod/v4";
import { withProfile } from "../../middleware/Session";
import { ApplicationSubmitSchema } from "../../schema/v2/Application";
import {
    AlreadySubmittedError,
    AnswerValidationError,
    ApplicationsClosedError,
    getActiveCycle,
    getApplicationForm,
    getApplicationsByUser,
    getRolesForCycle,
    submitApplication,
} from "../../services/Application/ApplicationService";
import { LoopsEvent, sendEmail } from "../../services/Email/EmailService";
import { uploadSupabaseFiles } from "../../storage/Storage";

// Shared error mapping, so every route turns the same service error into the
// same status code.
const handleApplicationError = (error: any, res: Response) => {
    if (error instanceof AnswerValidationError) {
        return res.status(400).json({ error: error.message, fields: error.errors });
    }
    if (error instanceof ApplicationsClosedError) {
        return res.status(403).json({ error: error.message });
    }
    if (error instanceof AlreadySubmittedError) {
        return res.status(409).json({ error: error.message });
    }
    // unique(user_id, role_id) -- belt and braces; the service normally catches
    // this first via AlreadySubmittedError.
    if (error?.code === "23505") {
        return res
            .status(409)
            .json({ error: "You have already applied to this role" });
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

// Resumes are PDFs only, capped so a large upload can't tie up the server.
const uploadResume = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) =>
        file.mimetype === "application/pdf"
            ? cb(null, true)
            : cb(new Error("Resume must be a PDF")),
}).single("resume");

// This app has no error-handling middleware, so a rejected upload (wrong type
// or over the size limit) would otherwise fall through to Express's default
// handler and return an HTML 500. Surface it as a 400 instead.
const handleResumeUpload = (req: Request, res: Response, next: NextFunction) =>
    uploadResume(req, res, (error: any) =>
        error ? res.status(400).json({ error: error.message }) : next()
    );

export const applicationRouter = Router();

// Every route below withProfile is guaranteed a User row, so req.user is safe
// to assert.
const userId = (req: Request) => req.user!.user_id;

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

// Uploads a resume and returns its stored path, which the client then submits as
// the `resume` answer. Kept separate from submit so a large file upload is
// retried on its own rather than replaying the whole form.
applicationRouter.post(
    "/resume",
    ...withProfile,
    handleResumeUpload,
    async (req: Request, res: Response) => {
        if (!req.file) {
            return res.status(400).json({ error: "No resume file provided" });
        }

        try {
            const cycle = await getActiveCycle();
            if (!cycle) {
                return res
                    .status(403)
                    .json({ error: "Applications are currently closed" });
            }

            // The user id must be in the path: uploads use upsert, so a shared
            // path would let one applicant's resume.pdf overwrite another's.
            const fileRefs = await uploadSupabaseFiles([req.file], {
                parentPath: `recruiting/${cycle.cycle_id}/${userId(req)}/`,
                bucketName: process.env.SUPABASE_RECRUITING_BUCKET!,
                isPublic: false,
            });

            return res.status(201).json({ resume: fileRefs[req.file.fieldname] });
        } catch (error) {
            return handleApplicationError(error, res);
        }
    }
);

// Submit an application for one role.
applicationRouter.post("/", ...withProfile, async (req: Request, res: Response) => {
    const result = ApplicationSubmitSchema.safeParse(req.body);
    if (!result.success) {
        return validationFailed(res, result.error);
    }

    try {
        const { application, role_name } = await submitApplication(
            userId(req),
            result.data
        );

        // A failed confirmation email must not fail an application that is
        // already committed -- log it and still return success.
        try {
            await sendEmail(userId(req), LoopsEvent.RecruitingApplicationReceived, {
                role_name,
            });
        } catch (emailError) {
            console.error("Failed to send application confirmation:", emailError);
        }

        return res.status(201).json(application);
    } catch (error) {
        return handleApplicationError(error, res);
    }
});

// The applicant's own applications, so the UI can show what they've submitted.
applicationRouter.get("/me", ...withProfile, async (req: Request, res: Response) => {
    try {
        return res.status(200).json(await getApplicationsByUser(userId(req)));
    } catch (error) {
        return handleApplicationError(error, res);
    }
});
