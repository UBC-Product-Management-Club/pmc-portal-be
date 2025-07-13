import { Request, Response, Router } from "express";
import { handleSupabaseOnboarding } from "../../services/auth/register";
import { getAllSupabaseUsers } from "../../services/auth/users";
import Stripe from "stripe";
import { User } from "../../schema/v1/User";

export const authRouter = Router()

interface onboardingBody {
   user: User,
   payment: Stripe.PaymentIntent
}

authRouter.post("/onboard", async (req: Request, res: Response) => {
    const { user, payment }: onboardingBody = req.body;
    try{

        // Add the user to the database (throws errors)
        await handleSupabaseOnboarding(user)
        // if (payment) {
        //     await addSupabaseTransaction(payment)
        // }

        return res
            .status(200)
            .json({
                message: "Supabase Login success. New user created"
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
    const { userId } : { userId: string }= req.body
    try{
        // const session: loginResponse | undefined = await handleSupabaseLogin(userUID, idToken)

        // // If user doesn't exist, return 302 to redirect
        // if (!session) {
        //     return res
        //         .status(302)
        //         .json({
        //             message: "User doesn't exist, redirecting to onboarding"
        //         })
        // }
        return res
            .status(200)
            //.cookie('session', session.sessionCookie, session.options)
            .json({
                message: "Supabase Login success"
            })

    } catch (error: any) {
        console.log(error)
        return res
            .status(400)
            .json({
                error: error.message
            })
    }
})

// TO DO: Add role-based access control to this in the future
authRouter.get("/users", async (req: Request, res: Response) => {
    try {
        const users = await getAllSupabaseUsers();
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
