import { Router } from "express";
import { userRouter} from "./users";
import { eventRouter } from "./event";

export const adminRouter = Router();

adminRouter.use("/users", userRouter)
adminRouter.use("/events", eventRouter)

