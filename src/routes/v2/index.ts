import { Router } from "express";
import { authRouter } from "./auth";
import { eventRouter } from "./event";
import { attendeeRouter } from "./attendee";
import { profileRouter } from "./profile";
import { paymentRouter } from "./payments";
import { eventFormRouter } from "./eventForm";
import { adminRouter } from "./admin";

export const v2ApiRouter = Router();

v2ApiRouter.use("/v2/admin", adminRouter);
v2ApiRouter.use("/v2/auth", authRouter);
v2ApiRouter.use("/v2/events", eventRouter);
v2ApiRouter.use("/v2/profile", profileRouter);
v2ApiRouter.use("/v2/attendee", attendeeRouter);
v2ApiRouter.use("/v2/payments", paymentRouter);
v2ApiRouter.use("/v2/eventForm", eventFormRouter);
