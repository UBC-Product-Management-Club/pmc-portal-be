import { Router } from "express";
import { authRouter } from "./auth";
import { eventRouter } from "./event";
import { attendeeRouter } from "./attendee";
import { profileRouter } from "./profile";
import { verifyIdToken } from "../middleware/auth";

export const apiRouter = Router()

apiRouter.use("/auth", authRouter)
apiRouter.use("/events", eventRouter)
apiRouter.use("/attendee", attendeeRouter)
apiRouter.use("/profile", profileRouter)

// Protected
apiRouter.use("/profile", verifyIdToken, profileRouter)
apiRouter.use("/events", verifyIdToken, eventRouter)


// other routes go here
