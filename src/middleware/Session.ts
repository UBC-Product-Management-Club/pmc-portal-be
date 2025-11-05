import { Request, Response, NextFunction } from "express";
import { auth } from "express-oauth2-jwt-bearer";
import { getUser } from "../services/User/UserService";
import { supabase } from "../config/supabase";

export const jwtCheck = auth({
    audience: process.env.JWT_AUDIENCE ?? "http://localhost:8000",
    issuerBaseURL: process.env.AUTH0_DOMAIN,
    tokenSigningAlg: "RS256",
});

export const sessionFilter = async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.auth?.payload.sub;
    if (!userId) {
        return res.status(401).json({
            message: "missing userId",
        });
    }
    // console.log(userId)
    try {
        const user = await getUser(userId);
        if (user) {
            req.user = user;
        }
    } catch (err) {
        console.error(err)
        return res.status(500).json({ message: "failed to fetch user for current session!" })
    }
    next();
};

export const supabaseJwtCheck = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: "Missing Authorization header" });
  }

  const token = authHeader.split(" ")[1];

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return res.status(401).json({ message: "Invalid Supabase token" });
  }
  next();
};

export const authenticated = [jwtCheck, sessionFilter];