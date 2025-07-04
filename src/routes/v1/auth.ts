import { Request, Response, Router } from "express";
import { onboard } from "../../services/auth/register";
import { handleLogin } from "../../services/auth/login";
import { getAllUsers } from "../../services/auth/users";
import { addTransaction } from "../../services/payments/add";
import Stripe from "stripe";
import { User } from "../../schema/User";

export const authRouter = Router()

interface onboardingBody {
   user: User,
   payment: Stripe.PaymentIntent
}

authRouter.post("/onboard", async (req: Request, res: Response) => {
    const { user, payment }: onboardingBody = req.body;
    try{
        if (!user || !payment) {
            throw Error("Bad request")
        }
        console.log(user)
        await onboard(user, payment)
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

// TODO return JWT
authRouter.post("/login", async (req: Request, res: Response) => {
    const { userId }: { userId: string } = req.body
    try {
        const user = await handleLogin(userId)
        if (user) {
            return res
                .status(200)
                .json(user)
        }
        return res
            .status(404)
            .json({
                message: "User not found"
            })
        } catch (error) {
        return res.status(500).json({message: "An error occurred"})
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
