import { Router } from "express";
import { userRouter} from "./users";
import { eventRouter } from "./event";
import { settingsRouter } from "./settings";

export const adminRouter = Router();

adminRouter.use("/users", userRouter)
adminRouter.use("/events", eventRouter)
adminRouter.use("/settings", settingsRouter)

