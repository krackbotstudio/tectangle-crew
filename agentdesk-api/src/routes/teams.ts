import { Router } from "express";
import { query } from "../db.js";
import { authRequired, adminRequired } from "../middleware/auth.js";
import { getAccessibleTeamIds, canAccessTeam } from "../services/access.js";

const router = Router();

interface TeamRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  icon: string | null;
  agent_count: string;
}

router.get("/", authRequired, async (req, res) => {
  const accessible = await getAccessibleTeamIds(req.user!);
  const params: unknown[] = [];
  let where = "";
  if (accessible !== null) {
    if (accessible.length === 0) {
      res.json({ teams: [] });
      return;
    }
    params.push(accessible);
    where = ` WHERE tg.id = ANY($${params.length}::uuid[])`;
  }

  const result = await query<TeamRow>(
    `SELECT tg.*, COUNT(a.id)::text AS agent_count
     FROM team_groups tg
     LEFT JOIN agents a ON a.team_group_id = tg.id
     ${where}
     GROUP BY tg.id
     ORDER BY tg.name`,
    params
  );

  res.json({
    teams: result.rows.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      description: t.description,
      color: t.color,
      icon: t.icon,
      agentCount: parseInt(t.agent_count, 10),
    })),
  });
});

router.get("/:slug", authRequired, async (req, res) => {
  const teamResult = await query<TeamRow>(
    "SELECT * FROM team_groups WHERE slug = $1",
    [req.params.slug]
  );
  const team = teamResult.rows[0];
  if (!team) {
    res.status(404).json({ error: "Team not found" });
    return;
  }

  if (!(await canAccessTeam(req.user!, team.id))) {
    res.status(403).json({ error: "You do not have access to this team" });
    return;
  }

  const agentsResult = await query<{
    id: string;
    slug: string;
    name: string;
    description: string | null;
    skills: string[];
    is_active: boolean;
    is_template: boolean;
    avatar_color: string | null;
    parent_agent_id: string | null;
    parent_agent_name: string | null;
    project_count: string;
  }>(
    `SELECT a.id, a.slug, a.name, a.description, a.skills, a.is_active, a.is_template,
            a.avatar_color, a.parent_agent_id, parent.name AS parent_agent_name,
            (SELECT COUNT(*)::text FROM project_agents pa WHERE pa.agent_id = a.id) AS project_count
     FROM agents a
     LEFT JOIN agents parent ON parent.id = a.parent_agent_id
     WHERE a.team_group_id = $1 ORDER BY a.is_template DESC, a.name`,
    [team.id]
  );

  res.json({
    team: {
      id: team.id,
      name: team.name,
      slug: team.slug,
      description: team.description,
      color: team.color,
      icon: team.icon,
    },
    agents: agentsResult.rows.map((a) => ({
      id: a.id,
      slug: a.slug,
      name: a.name,
      description: a.description,
      skills: a.skills,
      isActive: a.is_active,
      isTemplate: a.is_template,
      avatarColor: a.avatar_color,
      isClone: !!a.parent_agent_id,
      parentAgentName: a.parent_agent_name,
      shortId: a.id.slice(0, 8),
      projectGroupCount: parseInt(a.project_count, 10),
    })),
  });
});

router.post("/", authRequired, adminRequired, async (req, res) => {
  const { name, description, color, icon } = req.body as {
    name?: string;
    description?: string;
    color?: string;
    icon?: string;
  };

  if (!name?.trim()) {
    res.status(400).json({ error: "Team name is required" });
    return;
  }

  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const result = await query<TeamRow>(
    `INSERT INTO team_groups (name, slug, description, color, icon)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *, '0' AS agent_count`,
    [name.trim(), slug, description ?? null, color ?? "#6366f1", icon ?? "👥"]
  );

  const t = result.rows[0];
  res.status(201).json({
    team: {
      id: t.id,
      name: t.name,
      slug: t.slug,
      description: t.description,
      color: t.color,
      icon: t.icon,
      agentCount: 0,
    },
  });
});

export default router;
