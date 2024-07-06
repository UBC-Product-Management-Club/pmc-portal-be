import { Router } from "express";
import { handleRegister } from "../controllers/auth/register";
import { handleLogin } from "../controllers/auth/login";
import { auth } from "../config/firebase";

export const authRouter = Router()

authRouter.post("/register", handleRegister)
authRouter.post("/login", handleLogin)


// for testing authentication. Will probably need to be middleware later
authRouter.get("/test", async (req,res) => {
    // console.log(req.cookies)
    try {
        const sessionCookie = req.cookies.session || ''
        const decodedClaims = await auth.verifySessionCookie(sessionCookie, true)
        // console.log(decodedClaims)
        return res.sendStatus(200)
    } catch (error) {
        return res.sendStatus(401)
    }
})