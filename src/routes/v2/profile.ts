import { Request, Response, Router } from "express";
import { updateProfile } from "../../services/User/UserService";
import { ApiError, sendApiError } from "../../services/ApiError";

export const profileRouter = Router();

// The signed-in student's profile (loaded by the session middleware)
profileRouter.get("/profile", (req: Request, res: Response) => {
    if (!req.user) return res.status(404).json();
    return res.status(200).json(req.user);
});

// Edits the Profile fields a student may change; see profileRules for the allowlist
profileRouter.patch("/profile", async (req: Request, res: Response) => {
    if (!req.user) return res.status(404).json();
    try {
        return res.status(200).json(await updateProfile(req.user.user_id, req.body));
    } catch (error) {
        if (error instanceof ApiError) return sendApiError(res, error);
        console.error("Profile update error:", error);
        return res.status(500).json({ error: { code: "SERVER_ERROR", message: "Couldn't save. Please try again." } });
    }
});

// Takes email, returns user information. Temporary endpoint for firebase -> auth0 migration.
profileRouter.get("/email/:email", async (req: Request, res: Response) => {
    const mail: string = req.params.email;
    //const user = await getSupabaseProfileByEmail(mail)
    //if (user) {
    return res.status(200).json({
        message: `success on ${mail}`,
    });
    // } else {
    //     return res.status(404).json({
    //         error: "User not found"
    //     })
    // }
});


// Takes member ID, returns list of event IDs that member registered for
profileRouter.get("/:id/events", async (req: Request, res: Response) => {
    const uid: string = req.params.id;
    //const events = await getSupabaseRegisteredEvents(uid)
    //if (events) {
    return res.status(200).json({
        message: "supabase success",
    });
    // } else {
    //     return res.status(404).json({
    //         exists: false
    //     })
    // }
});
