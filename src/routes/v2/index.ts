import { Router } from "express";
import { authRouter } from "./auth";
import { eventRouter} from "./event";
import { attendeeRouter } from "./attendee";
import { profileRouter } from "./profile";
import { paymentRouter } from "./payments";
import { adminRouter } from "./admin";
import { applicationRouter } from "./application";
import { authenticated, requireAdmin, supabaseJwtCheck } from "../../middleware/Session";

export const v2ApiRouter = Router();

// A valid Supabase token only proves who the caller is; requireAdmin is what
// keeps non-execs out of the portal. It covers the whole subtree deliberately
// -- /admin/users returns every user record.
v2ApiRouter.use("/v2/admin", supabaseJwtCheck, requireAdmin, adminRouter);
v2ApiRouter.use("/v2/payments", paymentRouter);
v2ApiRouter.use("/v2/events", eventRouter);
v2ApiRouter.use("/v2/auth", authenticated, authRouter);
v2ApiRouter.use("/v2/profile", authenticated, profileRouter);
v2ApiRouter.use("/v2/attendee", authenticated, attendeeRouter);
// The form-definition GETs are public, so auth is applied per route rather
// than at the mount.
v2ApiRouter.use("/v2/application", applicationRouter);