import { Router } from "express";
import { handleRegister } from "../controllers/auth/register";
import { handleLogin } from "../controllers/auth/login";

export const authRouter = Router()

authRouter.post("/register", handleRegister)
authRouter.post("/login", handleLogin)