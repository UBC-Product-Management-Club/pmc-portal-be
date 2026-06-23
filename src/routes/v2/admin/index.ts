import { Router } from "express";
import { userRouter} from "./users";
import { eventRouter } from "./event";
import { recruitingFormRouter } from "./recruitingForm";

export const adminRouter = Router();

adminRouter.use("/users", userRouter)
adminRouter.use("/events", eventRouter)
adminRouter.use("/recruiting-forms", recruitingFormRouter)

