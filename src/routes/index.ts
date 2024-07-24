import { Router } from "express";
import { authRouter } from "./auth";
import { eventRouter } from "./event";
import { attendeeRouter } from "./attendee";

export const apiRouter = Router()

apiRouter.use("/auth", authRouter)
apiRouter.use("/events", eventRouter)
apiRouter.use("/attendee", attendeeRouter)




// other routes go here
