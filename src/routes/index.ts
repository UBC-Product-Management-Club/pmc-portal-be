import { Router } from "express";
import { authRouter } from "./auth";

export const apiRouter = Router()

apiRouter.use("/auth", authRouter)

// other routes go here
