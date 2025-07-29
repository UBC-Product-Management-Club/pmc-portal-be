import { Request, Response, Router } from "express";
import { handleSupabaseOnboarding } from "../../services/auth/register";
import { getAllSupabaseUsers } from "../../services/auth/users";
import Stripe from "stripe";
import { User } from "../../schema/v1/User";
import { handleSupabaseLogin } from "../../services/auth/login";

export const authRouter = Router();

interface onboardingBody {
    user: User;
    payment: Stripe.PaymentIntent;
}

authRouter.post("/onboard", async (req: Request, res: Response) => {
    const { user, payment }: onboardingBody = req.body;
    try {
        await handleSupabaseOnboarding(user);

        return res.status(200).json({
            message: "Supabase Login success. New user created",
        });
    } catch (error: any) {
        return res.status(500).json({
            error: error.message,
        });
    }
});

authRouter.post("/login", async (req: Request, res: Response) => {
    const { userId }: { userId: string } = req.body;
    try {
        const user = await handleSupabaseLogin(userId);

        if (user) {
            return res.status(200).json(user);
        }

        // // If user doesn't exist, return 302 to redirect
        return res.status(302).json({
            message: "User doesn't exist, redirecting to onboarding",
        });
    } catch (error: any) {
        console.log(error);
        return res.status(400).json({
            error: error.message,
        });
    }
});

// TO DO: Add role-based access control to this in the future
authRouter.get("/users", async (req: Request, res: Response) => {
    try {
        const users = await getAllSupabaseUsers();
        return res.status(200).send(users);
    } catch (error) {
        console.error(error);
        return res.status(500).send(error);
    }
});
