import { Router } from "express";
import { userRouter} from "./users";
import { eventRouter } from "./event";
import { applicationRouter } from "./application";

export const adminRouter = Router();

adminRouter.use("/users", userRouter)
adminRouter.use("/events", eventRouter)
adminRouter.use("/applications", applicationRouter)

