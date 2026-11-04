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

// Unset means nobody gets in, so a missing env var can't open up the admin routes.
const adminEmailDomains = () =>
  (process.env.ADMIN_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);

export const supabaseJwtCheck = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: "Missing Authorization header" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Missing bearer token" });
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return res.status(401).json({ message: "Invalid Supabase token" });
  }

  // Sign-ups are open on Supabase, so a valid token alone doesn't mean an admin.
  const allowedDomains = adminEmailDomains();
  const domain = data.user.email?.split("@").pop()?.toLowerCase();
  if (!domain || !allowedDomains.includes(domain)) {
    return res.status(403).json({ message: "Admin access requires a PMC email" });
  }

  // Without this, anyone could sign up with an unverified PMC address.
  if (!data.user.email_confirmed_at) {
    return res.status(403).json({ message: "Admin access requires a confirmed email" });
  }
  next();
};

export const authenticated = [jwtCheck, sessionFilter];