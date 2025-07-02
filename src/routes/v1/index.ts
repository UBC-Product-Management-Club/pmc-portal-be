import {Router} from "express";
import {authRouter} from "./auth";
import {eventRouter} from "./event";
import {attendeeRouter} from "./attendee";
import {profileRouter} from "../v2/profile";
import {paymentRouter} from "./payments";
import {eventFormRouter} from "./eventForm";
import { adminRouter } from "./admin";

export const v1ApiRouter = Router()

v1ApiRouter.use("/v1/admin", adminRouter)
v1ApiRouter.use("/v1/auth", authRouter)
v1ApiRouter.use("/v1/events", eventRouter)
v1ApiRouter.use("/v1/profile", profileRouter)
v1ApiRouter.use("/v1/attendee", attendeeRouter)
v1ApiRouter.use("/v1/payments", paymentRouter)
v1ApiRouter.use("/v1/eventForm", eventFormRouter)
