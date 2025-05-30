import { Request, Response, Router } from "express";
import { getAllUsers } from "../services/auth/users";
import { getProfile } from "../services/profile/get";

export const adminRouter = Router()

adminRouter.get('/users', async (req: Request, res: Response) => {
    try {
        const users = await getAllUsers();
        return res.status(200).send(users);
    } catch (error) {
        console.error(error);
        return res.status(500).send(error);
    }
});

adminRouter.get('/users/:id', async (req: Request, res: Response) => {
    try {
        const user = await getProfile(req.params.id);
        if (user) {
            return res.status(200).json(user);
        } else {
            return res.status(404).json({ error: 'User not found' });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Failed to get user" });
    }
});


