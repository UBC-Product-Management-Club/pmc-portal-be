import { Request, Response } from "express";
import { registerReqBody } from "./types";
import { db } from "../../config/firebase";


const handleOnboarding = async (req: Request, res: Response) => {
    const { uid, 
            first_name, 
            last_name, 
            student_id, 
            year, 
            faculty, 
            major, 
            why_PM, 
            returning_member }: registerReqBody = req.body

    // validate request?

    try {
        // Update user document with more info
        const docRef = db.collection("users").doc(uid)
        await docRef.update({
            first_name: first_name,
            last_name: last_name,
            student_id: student_id,
            year: year,
            faculty: faculty,
            major: major,
            why_PM: why_PM,
            returning_member: returning_member
        })

    } catch (error) {
        // console.log(error);
        return res.sendStatus(500);
    }

    // continue to dashboard
    return res.sendStatus(200)
}


export { handleOnboarding }