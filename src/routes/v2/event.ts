import { NextFunction, Request, Response, Router } from "express";
import { authenticated } from "../../middleware/Session";
import { getAttendee, submitApplication } from "../../services/Attendee/AttendeeService";
import { checkApplication, summarizeErrors } from "../../services/Attendee/applicationRules";
import { ApiError, sendApiError } from "../../services/ApiError";
import { getEvent, getEvents, getPublicEvent, getRegisteredContent, getRegisteredEvents } from "../../services/Event/EventService";
import { createUserTeam, getUserTeam, joinTeamWithCode, leaveUserTeam, renameUserTeam } from "../../services/Team/TeamService";
import { perUserRateLimit } from "../../middleware/rateLimit";
import { HomeRepository } from "../../storage/HomeRepository";

import multer from "multer";
import { DraftService } from "../../services/Drafts/DraftService";
import { LoopsEvent, sendEmail } from "../../services/Email/EmailService";
import { deliverApplicationReceipt } from "../../services/Email/EventEmailService";
import { deleteSupabaseFile, uploadSupabaseFiles } from "../../storage/Storage";
import { getPhases, getSubmission, saveSubmission } from "../../services/Submission/SubmissionService";

export const eventRouter = Router();

// Applications and submissions: a few files at most, none bigger than the largest
// allowed upload (a 25 MB deck). Each question's own limit is checked afterwards.
const formUpload = multer({ storage: multer.memoryStorage(), limits: { files: 5, fileSize: 25_000_000 } });

const acceptFiles = (req: Request, res: Response, next: NextFunction) => {
    formUpload.any()(req, res, (err: unknown) => {
        if (err instanceof multer.MulterError) {
            const tooLarge = err.code === "LIMIT_FILE_SIZE";
            return sendApiError(
                res,
                new ApiError(400, tooLarge ? "FILE_TOO_LARGE" : "VALIDATION_ERROR", tooLarge ? "That file is too large." : "Too many files.")
            );
        }
        if (err) return next(err);
        next();
    });
};

// The signed-in student's id; a login that hasn't finished onboarding has no User row
const userIdOf = (req: Request) => {
    const userId = req.user?.user_id;
    if (!userId) throw new ApiError(401, "UNAUTHENTICATED", "Sign in to continue.");
    return userId;
};

// A JSON body field that must be a string; type is checked before anything else
const textField = (value: unknown, field: string) => {
    if (typeof value !== "string") throw new ApiError(400, "VALIDATION_ERROR", `${field} is required.`, { [field]: "Required." });
    return value;
};

// ApiErrors go back as they are; anything else is logged and hidden behind a 500
const sendError = (res: Response, error: unknown, context: string) => {
    if (error instanceof ApiError) return sendApiError(res, error);
    console.error(`${context}:`, error);
    return res.status(500).json({ error: { code: "SERVER_ERROR", message: "Something went wrong. Please try again." } });
};

eventRouter.get("/", ...authenticated, async (req, res) => {
    try {
        const events = await getEvents();
        res.status(200).json(events);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

eventRouter.get("/:id", async (req, res) => {
    try {
        const eventByID = await getPublicEvent(req.params.id);
        res.status(200).json(eventByID);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

eventRouter.get("/events/registered", ...authenticated, async (req, res) => {
    const userId = req.user?.user_id;
    if (!userId) return res.status(400).json({ error: "User ID is required!" });

    try {
        const userCurrentEvents = await getRegisteredEvents(userId);
        return res.status(200).json(userCurrentEvents);
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

// Home's status badges: one row per event with a draft or an application
eventRouter.get("/events/statuses", ...authenticated, async (req: Request, res: Response) => {
    try {
        const { data, error } = await HomeRepository.eventStatuses(userIdOf(req));
        if (error) throw new Error(error.message);
        return res.status(200).json(data ?? []);
    } catch (error) {
        return sendError(res, error, "Event statuses error");
    }
});

eventRouter.get("/:eventId/attendee", ...authenticated, async (req: Request, res: Response) => {
    const userId = req.user?.user_id;
    const eventId = req.params.eventId;
    if (!userId) return res.status(400).json({ error: "User ID required!" });
    try {
        const attendee = await getAttendee(eventId, userId);
        return res.status(200).json(attendee);
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

eventRouter.get("/:eventId/registered-content", ...authenticated, async (req: Request, res: Response) => {
    try {
        const content = await getRegisteredContent(req.params.eventId, userIdOf(req));
        return res.status(200).json(content);
    } catch (error) {
        return sendError(res, error, "Registered content error");
    }
});

// Submits an application. Answers and files are checked here, then the database
// checks the window, duplicates and the cap while it saves (submit_application).
eventRouter.post("/:eventId/register", ...authenticated, acceptFiles, async (req: Request, res: Response) => {
    const userId = req.user?.user_id;
    const eventId = req.params.eventId;
    if (!userId) return res.status(401).json({ error: "User not authenticated" });

    let uploaded: string[] = [];
    const bucketName = process.env.SUPABASE_ATTENDEE_BUCKET_NAME!;
    try {
        const event = await getEvent(eventId);
        if (!event) throw new ApiError(404, "NOT_FOUND", "This event doesn't exist.");

        const { answers, files, errors } = await checkApplication(
            event.event_form_questions,
            req.body,
            (req.files as Express.Multer.File[]) ?? []
        );
        if (Object.keys(errors).length > 0) {
            const { code, fields } = summarizeErrors(errors);
            throw new ApiError(400, code, "Please fix the highlighted answers.", fields);
        }

        // Files go in a folder per student so two applicants' resumes never share a path
        const fileRefs = await uploadSupabaseFiles(files, {
            parentPath: `attendee/${eventId}/${userId}/`,
            bucketName,
            isPublic: false,
        });
        uploaded = Object.values(fileRefs);

        const attendee = await submitApplication(eventId, userId, { ...answers, ...fileRefs });
        // Reviewed events send their receipt from the application_received hook, so
        // it's never sent twice; events without review keep the old Loops event
        if (event.needs_review) {
            deliverApplicationReceipt(attendee.attendee_id);
        } else {
            sendEmail(userId, LoopsEvent.ApplicationReceived, {
                event_name: event.name!,
            });
        }
        return res.status(201).json({
            message: "Registration successful",
            attendee,
        });
    } catch (error: any) {
        // Nothing was saved, so don't keep the files
        await Promise.allSettled(uploaded.map((path) => deleteSupabaseFile(path, bucketName)));
        if (error instanceof ApiError) return sendApiError(res, error);
        console.error(error);
        return res.status(500).json({ error: { code: "SERVER_ERROR", message: "Couldn't submit. Please try again." } });
    }
});

eventRouter.get("/drafts/:eventId", ...authenticated, async (req, res) => {
    try {
        const { eventId } = req.params;
        const userId = req.user?.user_id;

        if (!userId || typeof userId !== "string") {
            return res.status(400).json({ error: "userId is required" });
        }

        const draftService = new DraftService();
        const draft = await draftService.loadDraft(eventId, userId);

        res.status(200).json(draft);
    } catch (error: any) {
        console.error("Error loading draft:", error);
        res.status(500).json({ error: error.message });
    }
});

eventRouter.post("/drafts/:eventId", ...authenticated, async (req, res) => {
    try {
        const { eventId } = req.params;
        const { draft, version } = req.body;

        const userId = req.user?.user_id;

        if (!userId || !draft) {
            return res.status(400).json({ error: "userId and draft are required" });
        }
        if (version !== undefined && !(Number.isInteger(version) && version >= 0)) {
            return sendApiError(res, new ApiError(400, "VALIDATION_ERROR", "version must be a whole number."));
        }

        const draftService = new DraftService();
        const savedDraft = await draftService.saveDraft(eventId, userId, draft, version);

        res.status(200).json(savedDraft);
    } catch (error: any) {
        if (error instanceof ApiError) return sendApiError(res, error);
        console.error("Error saving draft:", error);
        res.status(500).json({ error: error.message });
    }
});

eventRouter.delete("/drafts/:eventId", ...authenticated, async (req, res) => {
    try {
        const { eventId } = req.params;
        const userId = req.user?.user_id;

        if (!userId || typeof userId !== "string") {
            return res.status(400).json({ error: "userId is required" });
        }

        const draftService = new DraftService();
        await draftService.deleteDraft(eventId, userId);

        res.status(204).send();
    } catch (error: any) {
        console.error("Error deleting draft:", error);
        res.status(500).json({ error: error.message });
    }
});

// Submissions. The window, roster and version are decided by the database while it saves.
eventRouter.post("/:eventId/deliverable/:phaseId", ...authenticated, acceptFiles, async (req: Request, res: Response) => {
    try {
        const { eventId, phaseId } = req.params;
        const data = await saveSubmission(eventId, userIdOf(req), phaseId, req.body ?? {}, (req.files as Express.Multer.File[]) ?? []);
        return res.status(201).json({ message: "Submission saved", data });
    } catch (error) {
        return sendError(res, error, "Submission save error");
    }
});

eventRouter.get("/:eventId/deliverable/:phaseId", ...authenticated, async (req: Request, res: Response) => {
    try {
        return res.status(200).json(await getSubmission(req.params.eventId, userIdOf(req), req.params.phaseId));
    } catch (error) {
        return sendError(res, error, "Fetch submission error");
    }
});

// Team routes. The rules live in the database functions; these only read the request.
eventRouter.get("/:eventId/team", ...authenticated, async (req: Request, res: Response) => {
    try {
        return res.status(200).json(await getUserTeam(req.params.eventId, userIdOf(req)));
    } catch (error) {
        return sendError(res, error, "Fetch team error");
    }
});

eventRouter.post("/:eventId/team", ...authenticated, async (req: Request, res: Response) => {
    try {
        const teamName = textField(req.body?.team_name, "team_name");
        return res.status(201).json(await createUserTeam(req.params.eventId, userIdOf(req), teamName));
    } catch (error) {
        return sendError(res, error, "Create team error");
    }
});

// 10 tries a minute per student, so codes can't be guessed
eventRouter.post("/:eventId/team/join", ...authenticated, perUserRateLimit(10, 60_000), async (req: Request, res: Response) => {
    try {
        const teamCode = textField(req.body?.team_code, "team_code");
        return res.status(200).json(await joinTeamWithCode(req.params.eventId, userIdOf(req), teamCode));
    } catch (error) {
        return sendError(res, error, "Join team error");
    }
});

eventRouter.patch("/:eventId/team", ...authenticated, async (req: Request, res: Response) => {
    try {
        const teamName = textField(req.body?.team_name, "team_name");
        return res.status(200).json(await renameUserTeam(req.params.eventId, userIdOf(req), teamName));
    } catch (error) {
        return sendError(res, error, "Rename team error");
    }
});

eventRouter.delete("/:eventId/team", ...authenticated, async (req: Request, res: Response) => {
    try {
        await leaveUserTeam(req.params.eventId, userIdOf(req));
        return res.status(200).json({ message: "Left team successfully" });
    } catch (error) {
        return sendError(res, error, "Leave team error");
    }
});

eventRouter.get("/:eventId/flags", ...authenticated, async (req: Request, res: Response) => {
    try {
        return res.status(200).json(await getPhases(req.params.eventId, userIdOf(req)));
    } catch (error) {
        return sendError(res, error, "Fetch phases error");
    }
});
