import { Router } from "express";
import { authRouter } from "./auth";
import { eventsRouter } from "./events";

export const apiRouter = Router()

apiRouter.use("/auth", authRouter)
apiRouter.use("/dashboard", eventsRouter)

// other routes go here
