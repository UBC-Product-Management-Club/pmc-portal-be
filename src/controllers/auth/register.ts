import { Request, Response } from "express";
import { registerReqBody } from "./types";



const handleRegister = async (req: Request, res: Response) => {
    const { member_Id, 
            first_name, 
            last_name, 
            email,
            student_id, 
            year, 
            faculty, 
            major, 
            why_PM, 
            returning_member }: registerReqBody= req.body
    // do stuff with body
    return res.sendStatus(200)
}


export { handleRegister }