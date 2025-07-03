import {Request, Response, Router} from "express";
import {getProfile, getProfileByEmail, getRegisteredEvents} from "../../services/profile/get";
import {deleteUser} from "../../services/profile/delete";
// import { editProfile } from "../controllers/profile/edit";

export const profileRouter = Router()

// Get profile information
profileRouter.get("/:id", async (req: Request, res: Response) => {
    const uid: string = req.params.id
    const user = await getProfile(uid)
    if (user) {
        return res.status(200).json({
            exists: true,
            ...user
        })
    } else {
        return res.status(404).json({
            exists: false
        })
    }
})

// Takes email, returns user information. Temporary endpoint for firebase -> auth0 migration.
profileRouter.get("/email/:email", async (req: Request, res: Response) => {
    const mail: string = req.params.email
    const user = await getProfileByEmail(mail)
    if (user) {
        return res.status(200).json({
            exists: true,
            id: user
        })
    } else {
        return res.status(404).json({
            error: "User not found"
        })
    }
})

// Takes ID, deletes user. Temporary endpoint for firebase -> auth0 migration.
profileRouter.get("/:id/delete", async (req: Request, res: Response) => {
    const uid: string = req.params.id
    try {
        await deleteUser(uid)
        return res.status(200).json("Successfully deleted user")
    } catch (e) {
        return res.status(400).json({
            error: e
        })
    }
})

// Takes member ID, returns list of event IDs that member registered for
profileRouter.get("/:id/events", async (req: Request, res: Response) => {
    const uid: string = req.params.id
    const events = await getRegisteredEvents(uid)
    if (events) {
        return res.status(200).json({
            exists: true,
            events
        })
    } else {
        return res.status(404).json({
            exists: false
        })
    }
})

// Edit proflie
// profileRouter.put("/:id/edit", editProfile)
