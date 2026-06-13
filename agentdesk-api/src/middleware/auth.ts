import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";

export type UserRole = "admin" | "team_lead" | "team_member";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  team: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: AuthUser): string {
  return jwt.sign(user, config.jwtSecret, { expiresIn: "7d" });
}

export function authRequired(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  try {
    req.user = jwt.verify(header.slice(7), config.jwtSecret) as AuthUser;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function adminRequired(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

export function webhookAuth(req: Request, res: Response, next: NextFunction) {
  const secret = req.headers["x-agentdesk-secret"];
  if (secret !== config.webhookSecret) {
    res.status(401).json({ error: "Invalid webhook secret" });
    return;
  }
  next();
}
