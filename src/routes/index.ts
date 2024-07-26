import { Router } from "express";
import { authRouter } from "./auth";
import { eventRouter } from "./event";
import { profileRouter } from "./profile";
import { verifyIdToken } from "../middleware/auth";

export const apiRouter = Router()

apiRouter.use("/auth", authRouter)

// Protected
apiRouter.use("/profile", verifyIdToken, profileRouter)
apiRouter.use("/events", verifyIdToken, eventRouter)


// other routes go here
