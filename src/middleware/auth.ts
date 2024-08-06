import { Request, Response } from "express";
import { auth } from "../config/firebase";

const verifyIdToken = async (req: Request, res: Response, next: () => void) => {
    try {
        const sessionCookie = req.cookies.session || ''
        if (!sessionCookie) {
            // check if "continue as non-member"
        }
        await auth.verifySessionCookie(sessionCookie, true)
        console.log("Authorized")
        next()
    } catch (error: any) {
        return res.status(401).json({
            error: "Unauthorized access. Are you logged in?"
        })
    }
}

export { verifyIdToken }