import { Router } from "express";
import { getProfile } from "../controllers/profile/get";
import { editProfile } from "../controllers/profile/edit";

export const profileRouter = Router()

// GET profile information
profileRouter.get("/:id", getProfile)

profileRouter.put("/:id/edit", editProfile)
