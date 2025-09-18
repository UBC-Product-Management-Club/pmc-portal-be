import { Router } from "express";
import { authRouter } from "./auth";
import { eventRouter} from "./event";
import { attendeeRouter } from "./attendee";
import { profileRouter } from "./profile";
import { paymentRouter } from "./payments";
import { adminRouter } from "./admin";
import { authenticated, supabaseJwtCheck } from "../../middleware/Session";

export const v2ApiRouter = Router();

v2ApiRouter.use("/v2/admin", supabaseJwtCheck, adminRouter);
v2ApiRouter.use("/v2/payments", paymentRouter);
v2ApiRouter.use("/v2/events", eventRouter);
v2ApiRouter.use("/v2/auth", authenticated, authRouter);
v2ApiRouter.use("/v2/profile", authenticated, profileRouter);
v2ApiRouter.use("/v2/attendee", authenticated, attendeeRouter);