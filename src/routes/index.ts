import { Router } from "express";
import { authRouter } from "./auth";
import { eventRouter } from "./event";

export const apiRouter = Router()

apiRouter.use("/auth", authRouter)
apiRouter.use("/events", eventRouter)



// other routes go here
