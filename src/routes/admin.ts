import { Request, Response, Router } from "express";
import { exportUsers, getAllUsers } from "../services/auth/users";
import { getProfile } from "../services/profile/get";

export const adminRouter = Router();

adminRouter.get("/users", async (req: Request, res: Response) => {
    try {
        const users = await getAllUsers();
        return res.status(200).send(users);
    } catch (error) {
        console.error(error);
        return res.status(500).send(error);
    }
});

adminRouter.get("/users/export", async (req: Request, res: Response) => {
    try {
        const password = req.query.password as string;

        if (!password) {
            return res.status(401).send({ error: "Password is required" });
        }

        const isCSV = req.query.csv === "true";
        const users = await exportUsers(password, isCSV);

        if (isCSV) {
            res.setHeader("Content-Type", "text/csv");
            res.setHeader("Content-Disposition", "attachment; filename=users.csv");
            return res.status(200).send(users);
        }

        res.setHeader("Content-Type", "application/json");
        res.setHeader("Content-Disposition", "attachment; filename=users.json");
        return res.status(200).json(users);
    } catch (error: any) {
        console.error(error);
        if (error.message === "Invalid password") {
            return res.status(401).send({ error: "Invalid password" });
        }
        return res.status(500).send({ error: "Failed to export users" });
    }
});

adminRouter.get("/users/:id", async (req: Request, res: Response) => {
    try {
        const user = await getProfile(req.params.id);
        if (user) {
            return res.status(200).json(user);
        } else {
            return res.status(404).json({ error: "User not found" });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Failed to get user" });
    }
});
