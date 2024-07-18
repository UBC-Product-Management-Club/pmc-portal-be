import { Router } from "express";
import { getProfile } from "../controllers/profile/get";
// import { editProfile } from "../controllers/profile/edit";

export const profileRouter = Router()

// Get profile information
profileRouter.get("/:id", getProfile)

// Edit proflie
// profileRouter.put("/:id/edit", editProfile)
