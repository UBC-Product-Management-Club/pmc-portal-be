import {Router} from "express";
import {authRouter} from "./auth";
import {eventRouter} from "./event";
import {attendeeRouter} from "./attendee";
import {profileRouter} from "./profile";
import {paymentRouter} from "./payments";
import {eventFormRouter} from "./eventForm";
import { adminRouter } from "./admin";

export const apiRouter = Router()

apiRouter.use("/admin", adminRouter)
apiRouter.use("/auth", authRouter)
apiRouter.use("/events", eventRouter)
apiRouter.use("/profile", profileRouter)
apiRouter.use("/attendee", attendeeRouter)
apiRouter.use("/payments", paymentRouter)
apiRouter.use("/eventForm", eventFormRouter)
