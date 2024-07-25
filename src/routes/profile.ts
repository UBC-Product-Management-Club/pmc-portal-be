import { Request, Response, Router } from "express";
import { getProfile } from "../controllers/profile/get";
// import { editProfile } from "../controllers/profile/edit";

export const profileRouter = Router()

// Get profile information
profileRouter.get("/:id", async (req: Request, res: Response) => {
    const uid: string  = req.params.id
    try {
        const user = await getProfile(uid)
        return res.status(200).json({...user})
    } catch (error) {
        return res.status(400).json({
            message: error
        })
    }
})

// Edit proflie
// profileRouter.put("/:id/edit", editProfile)
