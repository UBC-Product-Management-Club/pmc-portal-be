import { Request, Response } from "express";
import { registerReqBody } from "./types";
import { db }    from "../../config/firebase";
import { getFirestore } from "firebase-admin/firestore";



const handleRegister = async (req: Request, res: Response) => {
    const { uid, 
            first_name, 
            last_name, 
            email,
            student_id, 
            year, 
            faculty, 
            major, 
            why_PM, 
            returning_member }: registerReqBody = req.body

    // validate request?

    try {

        const docRef = db.collection("users").doc(uid)
        await docRef.set({
            first_name: first_name,
            last_name: last_name,
            email: email,
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

    return res.sendStatus(200)
}


export { handleRegister }