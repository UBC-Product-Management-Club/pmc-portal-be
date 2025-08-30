import { Request, Response, Router } from "express";
import Stripe from "stripe";
import { User } from "../../schema/v1/User";
import { addUser, getUsers } from "../../services/User/UserService";

export const authRouter = Router();

authRouter.post("/onboard", async (req: Request, res: Response) => {
    const { user }: { user: User }= req.body;
    try {
        await addUser(user);
        return res.status(200).json({
            message: "Supabase Login success. New user created",
        });
    } catch (error: any) {
        return res.status(500).json({
            error: error.message,
        });
    }
});

authRouter.get("/me", async(req: Request, res: Response) => {
    return res.status(200).json(req.user)
})

// TO DO: Add role-based access control to this in the future
authRouter.get("/users", async (req: Request, res: Response) => {
    try {
        const users = await getUsers();
        return res.status(200).send(users);
    } catch (error) {
        console.error(error);
        return res.status(500).send(error);
    }
});
