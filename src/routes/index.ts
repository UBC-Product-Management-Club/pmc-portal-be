import { Router } from "express";
import { authRouter } from "./auth";
import { eventRouter } from "./event";
import { attendeeRouter } from "./attendee";
import { profileRouter } from "./profile";

export const apiRouter = Router()

apiRouter.use("/auth", authRouter)
apiRouter.use("/events", eventRouter)
apiRouter.use("/attendee", attendeeRouter)
apiRouter.use("/profile", profileRouter)



// other routes go here
