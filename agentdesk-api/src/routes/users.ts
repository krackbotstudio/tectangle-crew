import bcrypt from "bcryptjs";
import { Router } from "express";
import { query } from "../db.js";
import { authRequired, adminRequired, type AuthUser } from "../middleware/auth.js";

const router = Router();

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: AuthUser["role"];
  team: string | null;
  is_active: boolean;
  created_at: string;
}

async function getTeamAccess(userId: string) {
  const result = await query<{ id: string; slug: string; name: string }>(
    `SELECT tg.id, tg.slug, tg.name
     FROM user_team_access uta
     JOIN team_groups tg ON tg.id = uta.team_group_id
     WHERE uta.user_id = $1
     ORDER BY tg.name`,
    [userId]
  );
  return result.rows;
}

async function getProjectAccess(userId: string) {
  const result = await query<{ id: string; title: string }>(
    `SELECT p.id, p.title
     FROM user_project_access upa
     JOIN projects p ON p.id = upa.project_id
     WHERE upa.user_id = $1
     ORDER BY p.title`,
    [userId]
  );
  return result.rows;
}

async function mapUser(row: UserRow) {
  const [teamAccess, projectAccess] = await Promise.all([
    getTeamAccess(row.id),
    getProjectAccess(row.id),
  ]);
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    team: row.team,
    isActive: row.is_active,
    createdAt: row.created_at,
    teamAccess,
    projectAccess,
  };
}

async function setTeamAccess(userId: string, teamGroupIds: string[]) {
  await query("DELETE FROM user_team_access WHERE user_id = $1", [userId]);
  for (const teamGroupId of teamGroupIds) {
    await query(
      `INSERT INTO user_team_access (user_id, team_group_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, teamGroupId]
    );
  }
}

async function setProjectAccess(userId: string, projectIds: string[]) {
  await query("DELETE FROM user_project_access WHERE user_id = $1", [userId]);
  for (const projectId of projectIds) {
    await query(
      `INSERT INTO user_project_access (user_id, project_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, projectId]
    );
  }
}

router.get("/", authRequired, adminRequired, async (_req, res) => {
  const result = await query<UserRow>(
    "SELECT id, email, name, role, team, is_active, created_at FROM users ORDER BY created_at"
  );
  res.json({
    users: await Promise.all(result.rows.map(mapUser)),
  });
});

router.post("/", authRequired, adminRequired, async (req, res) => {
  const { email, name, password, role, team, teamGroupIds, projectIds } = req.body as {
    email?: string;
    name?: string;
    password?: string;
    role?: AuthUser["role"];
    team?: string | null;
    teamGroupIds?: string[];
    projectIds?: string[];
  };

  if (!email?.trim() || !name?.trim() || !password?.trim()) {
    res.status(400).json({ error: "Email, name, and password are required" });
    return;
  }

  const validRoles: AuthUser["role"][] = ["admin", "team_lead", "team_member"];
  const userRole = role && validRoles.includes(role) ? role : "team_member";

  const existing = await query<{ id: string }>("SELECT id FROM users WHERE email = $1", [
    email.toLowerCase().trim(),
  ]);
  if (existing.rows[0]) {
    res.status(409).json({ error: "A user with this email already exists" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const result = await query<UserRow>(
    `INSERT INTO users (email, password_hash, name, role, team, is_active)
     VALUES ($1, $2, $3, $4, $5, true)
     RETURNING id, email, name, role, team, is_active, created_at`,
    [email.toLowerCase().trim(), passwordHash, name.trim(), userRole, team ?? null]
  );

  const user = result.rows[0];
  if (teamGroupIds?.length) await setTeamAccess(user.id, teamGroupIds);
  if (projectIds?.length) await setProjectAccess(user.id, projectIds);

  res.status(201).json({ user: await mapUser(user) });
});

router.patch("/:id", authRequired, adminRequired, async (req, res) => {
  const { name, role, team, isActive, teamGroupIds, projectIds } = req.body as {
    name?: string;
    role?: AuthUser["role"];
    team?: string | null;
    isActive?: boolean;
    teamGroupIds?: string[];
    projectIds?: string[];
  };

  const target = await query<UserRow>(
    "SELECT id, email, name, role, team, is_active, created_at FROM users WHERE id = $1",
    [req.params.id]
  );
  if (!target.rows[0]) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (role && target.rows[0].role === "admin" && role !== "admin") {
    const adminCount = await query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM users WHERE role = 'admin' AND is_active = true"
    );
    if (parseInt(adminCount.rows[0]?.count ?? "0", 10) <= 1) {
      res.status(403).json({ error: "Cannot demote the last active admin" });
      return;
    }
  }

  const result = await query<UserRow>(
    `UPDATE users SET
      name = COALESCE($2, name),
      role = COALESCE($3, role),
      team = COALESCE($4, team),
      is_active = COALESCE($5, is_active),
      updated_at = NOW()
     WHERE id = $1
     RETURNING id, email, name, role, team, is_active, created_at`,
    [req.params.id, name ?? null, role ?? null, team === undefined ? null : team, isActive ?? null]
  );

  const user = result.rows[0];
  if (teamGroupIds !== undefined) await setTeamAccess(user.id, teamGroupIds);
  if (projectIds !== undefined) await setProjectAccess(user.id, projectIds);

  res.json({ user: await mapUser(user) });
});

router.post("/:id/reset-password", authRequired, async (req, res) => {
  const { password } = req.body as { password?: string };
  if (!password?.trim() || password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }

  const isSelf = req.user?.id === req.params.id;
  const isAdmin = req.user?.role === "admin";
  if (!isSelf && !isAdmin) {
    res.status(403).json({ error: "Admin access required to reset another user's password" });
    return;
  }

  const target = await query<{ id: string }>("SELECT id FROM users WHERE id = $1", [req.params.id]);
  if (!target.rows[0]) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await query("UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1", [
    req.params.id,
    passwordHash,
  ]);

  res.json({ reset: true });
});

router.delete("/:id", authRequired, adminRequired, async (req, res) => {
  if (req.user?.id === req.params.id) {
    res.status(403).json({ error: "You cannot remove your own account" });
    return;
  }

  const target = await query<UserRow>(
    "SELECT id, role, is_active FROM users WHERE id = $1",
    [req.params.id]
  );
  if (!target.rows[0]) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (target.rows[0].role === "admin") {
    const adminCount = await query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM users WHERE role = 'admin' AND is_active = true AND id != $1",
      [req.params.id]
    );
    if (parseInt(adminCount.rows[0]?.count ?? "0", 10) < 1) {
      res.status(403).json({ error: "Cannot remove the last admin" });
      return;
    }
  }

  await query("UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1", [
    req.params.id,
  ]);
  res.json({ deactivated: true });
});

export default router;
