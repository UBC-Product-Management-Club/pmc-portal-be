import { Router } from "express";
import { authRouter } from "./auth";
import { eventRouter } from "./event";
import { attendeeRouter } from "./attendee";
import { profileRouter } from "./profile";
// import { verifyIdToken } from "../middleware/auth";
import { paymentRouter } from "./payments";

export const apiRouter = Router()

apiRouter.use("/auth", authRouter)
apiRouter.use("/events", eventRouter)
apiRouter.use("/profile", profileRouter)
apiRouter.use("/attendee", attendeeRouter)
apiRouter.use("/payments", paymentRouter)

// Protected
// apiRouter.use("/profile", verifyIdToken, profileRouter)


// other routes go here
