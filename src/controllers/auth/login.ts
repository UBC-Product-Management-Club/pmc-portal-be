import { Request, Response } from "express"
import { loginReqBody } from "./types"
import { auth } from "../../config/firebase"



/*
    Request Body must include:
        - user : User object returned from successful firebase authentication
        - idToken: idToken returned from successful firebase authentication. Used to exchange for session cookie
*/
const handleLogin = async (req: Request, res: Response) => {
    const { user, idToken }: loginReqBody = req.body
    console.log(user.uid)
    console.log(user.displayName)
    console.log(user.email)
    console.log(user.photoURL)
    console.log(idToken)

    const expiresIn = 60 * 60 * 1000

    // check if user exists. If yes, redirect to /dashboard and return session_id. If no, go to /onboarding

    try {
        // exchanges idToken for session cookie
        const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn })
        const options = { maxAge: expiresIn, httpOnly: true, secure: true}
        res.cookie('session', sessionCookie, options)
    } catch (error) {
        console.log(error);
        res.sendStatus(401)
    }


    res.sendStatus(200)
}

export { handleLogin }