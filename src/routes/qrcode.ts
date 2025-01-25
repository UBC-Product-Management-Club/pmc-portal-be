import { Router } from 'express';
import crypto from 'crypto';
import { getAttendeeById } from "../controllers/events/attendee";
import { getEventById } from "../controllers/events/event";
import { Attendee } from "../schema/Event";
import { checkEmail } from "../controllers/qrCode"

export const qrCodeRouter = Router();

const generateRandomId = (): string => {
    return crypto.randomBytes(8).toString("hex");
};

// link: www.pmcportal/<EVENT_ID>/?<UNIQUE PARAM id>
// :qrCodeId is made manually from the database


qrCodeRouter.get("/checkEmail", async (req, res) => {
    try {
        const { email } = req.body;
        const response = await checkEmail(email);
        res.status(200).json({ exist: response })

    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});