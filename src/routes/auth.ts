import { Router } from "express";
import { handleRegister } from "../controllers/auth/register";

export const authRouter = Router()

authRouter.post("/register", handleRegister)