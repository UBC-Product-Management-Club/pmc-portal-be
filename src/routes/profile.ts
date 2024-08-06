import { Request, Response, Router } from "express";
import { getProfile } from "../controllers/profile/get";
// import { editProfile } from "../controllers/profile/edit";

export const profileRouter = Router()

// Get profile information
profileRouter.get("/:id", async (req: Request, res: Response) => {
    const uid: string  = req.params.id
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

// Edit proflie
// profileRouter.put("/:id/edit", editProfile)
