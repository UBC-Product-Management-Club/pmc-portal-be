import { Request, Response, Router } from "express";
import { handleOnboarding } from "../controllers/auth/register";
import { handleLogin } from "../controllers/auth/login";
import { loginReqBody, loginResponse, onboardingReqBody } from "../controllers/auth/types";
import { getAllUsers } from "../controllers/auth/users";
import { addTransaction } from "../controllers/payments/add";

export const authRouter = Router()

authRouter.post("/onboard", async (req: Request, res: Response) => {
    const { onboardingInfo, paymentInfo }: onboardingReqBody = req.body;
    try{

        // Add the user to the database (throws errors)
        await handleOnboarding(onboardingInfo)
        if (paymentInfo) {
            await addTransaction(paymentInfo)
        }

        return res
            .status(200)
            .json({
                message: "Login success. New user created"
            })
    } catch (error: any) {
        return res
            .status(500)
            .json({
                error: error.message
            })
    }
})

authRouter.post("/login", async (req: Request, res: Response) => {
    const { userUID, idToken }: loginReqBody = req.body
    try{
        const session: loginResponse | undefined = await handleLogin(userUID, idToken)

        // If user doesn't exist, return 302 to redirect
        if (!session) {
            return res
                .status(302)
                .json({
                    message: "User doesn't exist, redirecting to onboarding"
                })
        }
        return res
            .status(200)
            .cookie('session', session.sessionCookie, session.options)
            .json({
                message: "Login success"
            })
    } catch (error: any) {
        console.log(error)
        return res
            .status(400)
            .json({
                error: error.message
            })
        // show error component
    }
})

// TO DO: Add role-based access control to this in the future
authRouter.get("/users", async (req: Request, res: Response) => {
    try {
        const users = await getAllUsers();
        return res.status(200).send(users);
    } catch (error) {
        console.error(error);
        return res.status(500).send(error);
    }
})


// for testing authentication. Will probably need to be middleware later
// authRouter.get("/test", async (req,res) => {
//     // console.log(req.cookies)
//     try {
//         const sessionCookie = req.cookies.session || ''
//         const decodedClaims = await auth.verifySessionCookie(sessionCookie, true)
//         // console.log(decodedClaims)
//         return res.sendStatus(200)
//     } catch (error) {
//         return res.sendStatus(401)
//     }
// })
