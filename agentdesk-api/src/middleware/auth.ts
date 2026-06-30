import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { query } from "../db.js";
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

/** Resolve the current user row — handles stale JWT ids after embedded DB resets. */
export async function resolveSessionUser(payload: AuthUser): Promise<AuthUser | null> {
  type UserRow = AuthUser & { is_active: boolean };

  const byId = await query<UserRow>(
    `SELECT id, email, name, role, team, COALESCE(is_active, true) AS is_active
     FROM users WHERE id = $1`,
    [payload.id]
  );
  if (byId.rows[0]) {
    if (!byId.rows[0].is_active) return null;
    const { is_active: _, ...user } = byId.rows[0];
    return user;
  }

  if (payload.email) {
    const byEmail = await query<UserRow>(
      `SELECT id, email, name, role, team, COALESCE(is_active, true) AS is_active
       FROM users WHERE email = $1`,
      [payload.email.toLowerCase()]
    );
    if (byEmail.rows[0]) {
      if (!byEmail.rows[0].is_active) return null;
      const { is_active: _, ...user } = byEmail.rows[0];
      return user;
    }
  }

  return null;
}

export async function authRequired(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret) as AuthUser;
    const user = await resolveSessionUser(payload);
    if (!user) {
      res.status(401).json({ error: "Session expired. Please sign in again." });
      return;
    }
    req.user = user;
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
