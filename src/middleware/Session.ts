import { Request, Response, NextFunction } from "express";
import { auth } from "express-oauth2-jwt-bearer";
import { getUser } from "../services/User/UserService";
import { supabase } from "../config/supabase";
import { AdminAllowlistRepository } from "../storage/AdminAllowlistRepository";

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

// Verifies the caller holds a valid Supabase Auth token -- who they are, not
// what they may do. requireAdmin is what decides the latter.
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

  // Permissions are keyed by email, so an account without one (Supabase allows
  // phone-only sign-ups) can never be matched against the allowlist.
  if (!data.user.email) {
    return res.status(401).json({ message: "Supabase account has no email address" });
  }

  req.supabaseUser = { id: data.user.id, email: data.user.email };
  next();
};

// Gates the whole admin portal on the Admin_Allowlist table. Must run after
// supabaseJwtCheck, which is what puts the verified email on the request.
export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const email = req.supabaseUser?.email;
  if (!email) {
    console.error("requireAdmin ran without supabaseJwtCheck ahead of it");
    return res.status(500).json({ message: "Authorization is misconfigured" });
  }

  // Allowlist rows are stored lowercase (enforced by a check constraint), so
  // normalising here makes the lookup an exact match rather than a pattern one.
  const { data: admin, error } = await AdminAllowlistRepository.getByEmail(
    email.trim().toLowerCase()
  );
  if (error) {
    // Never fall through to next() here -- a lookup failure must close the
    // door, not open it.
    console.error("Failed to read the admin allowlist:", error);
    return res.status(500).json({ message: "Failed to check admin access" });
  }
  if (!admin) {
    return res.status(403).json({ message: "Not authorized for the admin portal" });
  }

  req.admin = admin;
  next();
};

// Restricts an individual route to the two roles that can act on an
// application's outcome. Every allowlisted exec passes requireAdmin; only these
// pass this.
export const requireVP = (req: Request, res: Response, next: NextFunction) => {
  const role = req.admin?.role;
  if (!role) {
    console.error("requireVP ran without requireAdmin ahead of it");
    return res.status(500).json({ message: "Authorization is misconfigured" });
  }
  if (role !== "VP" && role !== "PRESIDENT") {
    return res.status(403).json({ message: "Only VPs can perform this action" });
  }
  next();
};

// sessionFilter calls next() even when no User row matches the token, which
// happens for an account that never finished onboarding. Routes that actually
// need a profile use `withProfile` instead of repeating this check themselves.
export const requireProfile = (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.user_id) {
        return res
            .status(401)
            .json({ error: "No user profile found for this account" });
    }
    next();
};

export const authenticated = [jwtCheck, sessionFilter];
export const withProfile = [jwtCheck, sessionFilter, requireProfile];