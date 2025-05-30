import { Request, Response } from "express";
import { User } from "../../schema/User";
import { db } from "../../config/firebase";

const editProfile = async (req: Request, res: Response) => {
    const uid: string = req.params.id
    
    // what are we allowing users to edit?
    const newUser: User = req.body
    try {
        const userRef = db.collection("users").doc(uid)
        await userRef.set({...newUser})
    } catch (error) {
        return res.status(500).send({
            "message": "error editing profile"
        })
    }
    return res.sendStatus(200)
}

export { editProfile }