import { Request, Response } from "express";
import { db } from "../../config/firebase";
import { User } from "../../schema/User";

const getProfile = async (req: Request, res: Response) => {
    const uid: string  = req.params.id
    try {
        const docRef = db.collection("users").doc(uid)
        const userRef = await docRef.get()
        if (userRef.exists) {
            const user = userRef.data() as User
            return res.send(200).json({...user})
        } else {
            throw Error()
        }
    } catch (error) {
        // console.log(error)
        return res.status(500).json({
            "message": "error retrieving profile"
        })
    }
}

export { getProfile }