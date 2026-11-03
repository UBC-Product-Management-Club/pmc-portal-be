import { Request, Response, Router } from "express";
import { HomeRepository } from "../../storage/HomeRepository";

export const announcementRouter = Router();

// Live Home announcements for the caller: members get everyone and members
// rows, everyone else gets everyone and non_members rows
announcementRouter.get("/", async (req: Request, res: Response) => {
    const { data, error } = await HomeRepository.activeAnnouncements(req.user?.is_payment_verified === true);
    if (error) {
        console.error("Announcements error:", error);
        return res.status(500).json({ error: { code: "SERVER_ERROR", message: "Couldn't load announcements." } });
    }
    return res.status(200).json(data ?? []);
});
