import { Request, Response } from "express"
import { loginReqBody } from "./types"

const handleLogin = async (req: Request, res: Response) => {
    const { email, password }: loginReqBody = req.body
    console.log(email)
    console.log(password)
    // do stuff here
    return res.sendStatus(200)
}

export { handleLogin }