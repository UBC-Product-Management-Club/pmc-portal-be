import { NextFunction, Request, Response } from "express";
import { ApiError, sendApiError } from "../services/ApiError";

// Allows `limit` requests per signed-in user in any `windowMs`. Counts live in
// this instance's memory, which is enough to stop someone guessing team codes;
// a restart or another Cloud Run instance starts from zero.
export const perUserRateLimit = (limit: number, windowMs: number) => {
  const hits = new Map<string, number[]>();

  return (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.user_id;
    if (!userId) return next();

    const now = Date.now();
    const recent = (hits.get(userId) ?? []).filter((at) => now - at < windowMs);
    if (recent.length >= limit) {
      hits.set(userId, recent);
      res.set("Retry-After", String(Math.ceil((recent[0] + windowMs - now) / 1000)));
      return sendApiError(res, new ApiError(429, "RATE_LIMITED", "Too many tries. Wait a minute, then try again."));
    }
    recent.push(now);
    hits.set(userId, recent);
    next();
  };
};
