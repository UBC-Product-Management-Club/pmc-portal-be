import { Request, Response, Router } from "express";
import {
    POSITIONS,
    getQuestionsForPosition,
} from "../../config/recruitingQuestions";
import { authenticated } from "../../middleware/Session";
import { ApplicationSubmissionSchema } from "../../schema/v2/Application";
import {
    getActiveCycle,
    getApplicationsByUser,
    submitApplication,
} from "../../services/Application/ApplicationService";

export const applicationRouter = Router();

// Public: the questions to render for an application form. Static config with
// nothing sensitive, so applicants can see the form before logging in. Without
// ?position returns the base questions; with one, base + that role's questions.
applicationRouter.get("/questions", (req: Request, res: Response) => {
    const position = req.query.position as string | undefined;
    return res.status(200).json({
        positions: POSITIONS,
        position: position ?? null,
        questions: getQuestionsForPosition(position),
    });
});

// Submit an application for one position as the authenticated applicant.
// Note the req.user guard is NOT redundant with `authenticated`: sessionFilter
// verifies the token but still calls next() when no User row exists for it, so
// req.user can be undefined here (e.g. a valid Auth0 account that never
// completed onboarding).
applicationRouter.post("/", ...authenticated, async (req: Request, res: Response) => {
    const userId = req.user?.user_id;
    if (!userId) {
        return res.status(401).json({ error: "No user profile found for this account" });
    }

    const result = ApplicationSubmissionSchema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({ error: result.error.message });
    }

    try {
        // Submissions attach to the active hiring cycle; none active = closed.
        const cycle = await getActiveCycle();
        if (!cycle) {
            return res
                .status(403)
                .json({ error: "Applications are currently closed" });
        }

        const application = await submitApplication(
            userId,
            result.data,
            cycle.cycle_id
        );
        return res.status(201).json(application);
    } catch (error: any) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }
});

// Retrieve all of the authenticated applicant's submissions (one per position).
applicationRouter.get("/me", ...authenticated, async (req: Request, res: Response) => {
    const userId = req.user?.user_id;
    if (!userId) {
        return res.status(401).json({ error: "No user profile found for this account" });
    }

    try {
        const applications = await getApplicationsByUser(userId);
        return res.status(200).json(applications);
    } catch (error: any) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }
});
