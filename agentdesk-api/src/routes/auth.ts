import bcrypt from "bcryptjs";
import { Router } from "express";
import { randomBytes } from "crypto";
import { query } from "../db.js";
import { authRequired, signToken, type AuthUser } from "../middleware/auth.js";
import { config } from "../config.js";

const router = Router();

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: AuthUser["role"];
  team: string | null;
  password_hash: string | null;
  google_id: string | null;
  avatar_url: string | null;
  is_active?: boolean;
}

function toAuthUser(row: Pick<UserRow, "id" | "email" | "name" | "role" | "team">): AuthUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    team: row.team,
  };
}

async function assertUserActive(userId: string): Promise<boolean> {
  const activeCheck = await query<{ is_active: boolean }>(
    "SELECT COALESCE(is_active, true) AS is_active FROM users WHERE id = $1",
    [userId]
  );
  return activeCheck.rows[0]?.is_active !== false;
}

async function issueAuthResponse(user: UserRow) {
  const authUser = toAuthUser(user);
  return { token: signToken(authUser), user: authUser };
}

router.post("/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: "Email and password required" });
    return;
  }

  const result = await query<UserRow>(
    "SELECT id, email, name, role, team, password_hash FROM users WHERE email = $1",
    [email.toLowerCase()]
  );

  const user = result.rows[0];
  if (!user?.password_hash || !(await bcrypt.compare(password, user.password_hash))) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  if (!(await assertUserActive(user.id))) {
    res.status(403).json({ error: "Account deactivated. Contact your workspace admin." });
    return;
  }

  res.json(await issueAuthResponse(user));
});

router.post("/register", async (req, res) => {
  if (!config.allowSignup) {
    res.status(403).json({ error: "Sign up is disabled. Contact your workspace admin." });
    return;
  }

  const { email, password, name } = req.body as {
    email?: string;
    password?: string;
    name?: string;
  };

  if (!email?.trim() || !password?.trim() || !name?.trim()) {
    res.status(400).json({ error: "Name, email, and password are required" });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existing = await query<{ id: string }>("SELECT id FROM users WHERE email = $1", [
    normalizedEmail,
  ]);
  if (existing.rows[0]) {
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const result = await query<UserRow>(
    `INSERT INTO users (email, password_hash, name, role, auth_provider, is_active)
     VALUES ($1, $2, $3, 'team_member', 'local', true)
     RETURNING id, email, name, role, team, password_hash, google_id, avatar_url`,
    [normalizedEmail, passwordHash, name.trim()]
  );

  res.status(201).json(await issueAuthResponse(result.rows[0]));
});

router.get("/providers", (_req, res) => {
  res.json({
    google: Boolean(config.googleClientId && config.googleClientSecret),
    allowSignup: config.allowSignup,
  });
});

router.get("/google", (_req, res) => {
  if (!config.googleClientId || !config.googleClientSecret) {
    res.status(503).json({ error: "Google sign-in is not configured on this server" });
    return;
  }

  const state = randomBytes(16).toString("hex");
  const params = new URLSearchParams({
    client_id: config.googleClientId,
    redirect_uri: config.googleRedirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    prompt: "select_account",
    state,
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

router.get("/google/callback", async (req, res) => {
  const code = req.query.code as string | undefined;
  const error = req.query.error as string | undefined;

  if (error || !code) {
    res.redirect(`${config.frontendUrl}/login?error=${encodeURIComponent(error || "Google sign-in cancelled")}`);
    return;
  }

  if (!config.googleClientId || !config.googleClientSecret) {
    res.redirect(`${config.frontendUrl}/login?error=${encodeURIComponent("Google sign-in not configured")}`);
    return;
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.googleClientId,
        client_secret: config.googleClientSecret,
        redirect_uri: config.googleRedirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };

    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(tokenData.error_description || tokenData.error || "Token exchange failed");
    }

    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = (await profileRes.json()) as {
      id?: string;
      email?: string;
      name?: string;
      picture?: string;
    };

    if (!profile.id || !profile.email) {
      throw new Error("Google profile missing required fields");
    }

    let user = await query<UserRow>(
      "SELECT id, email, name, role, team, password_hash, google_id, avatar_url FROM users WHERE google_id = $1 OR email = $2",
      [profile.id, profile.email.toLowerCase()]
    );

    if (!user.rows[0]) {
      if (!config.allowSignup) {
        res.redirect(
          `${config.frontendUrl}/login?error=${encodeURIComponent("No account found. Ask an admin to invite you.")}`
        );
        return;
      }

      const created = await query<UserRow>(
        `INSERT INTO users (email, name, role, google_id, avatar_url, auth_provider, is_active)
         VALUES ($1, $2, 'team_member', $3, $4, 'google', true)
         RETURNING id, email, name, role, team, password_hash, google_id, avatar_url`,
        [profile.email.toLowerCase(), profile.name || profile.email.split("@")[0], profile.id, profile.picture ?? null]
      );
      user = created;
    } else if (!user.rows[0].google_id) {
      await query(
        "UPDATE users SET google_id = $2, avatar_url = COALESCE($3, avatar_url), auth_provider = 'google', updated_at = NOW() WHERE id = $1",
        [user.rows[0].id, profile.id, profile.picture ?? null]
      );
    }

    const row = user.rows[0];
    if (!(await assertUserActive(row.id))) {
      res.redirect(
        `${config.frontendUrl}/login?error=${encodeURIComponent("Account deactivated. Contact your workspace admin.")}`
      );
      return;
    }

    const { token } = await issueAuthResponse(row);
    res.redirect(`${config.frontendUrl}/auth/callback?token=${encodeURIComponent(token)}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Google sign-in failed";
    res.redirect(`${config.frontendUrl}/login?error=${encodeURIComponent(message)}`);
  }
});

router.get("/me", authRequired, (req, res) => {
  res.json({ user: req.user! });
});

export default router;
