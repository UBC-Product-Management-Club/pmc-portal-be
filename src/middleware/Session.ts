import { Request, Response, NextFunction } from "express";
import { auth } from "express-oauth2-jwt-bearer";
import { getUser } from "../services/User/UserService";

export const jwtCheck = auth({
    audience: process.env.jwt_audience ?? "http://localhost:8000",
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
        throw err;
    }
    next();
};

export const authenticated = [jwtCheck, sessionFilter];
