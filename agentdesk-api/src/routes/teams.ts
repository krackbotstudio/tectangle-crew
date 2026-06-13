import { Router } from "express";
import { query } from "../db.js";
import { authRequired, adminRequired } from "../middleware/auth.js";
import { getAccessibleTeamIds, canAccessTeam } from "../services/access.js";

const router = Router();

function routeParam(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

interface TeamRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  icon: string | null;
  rules: string[];
  constraints: string[];
  agent_count?: string;
}

interface TeamProjectRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  team_agent_count: string;
  work_project_id: string | null;
}

interface ToolRequestRow {
  id: string;
  team_group_id: string;
  project_id: string | null;
  project_title: string | null;
  tool_name: string;
  category: string;
  reason: string | null;
  url: string | null;
  status: string;
  requested_by: string | null;
  requester_name: string | null;
  created_at: string;
  updated_at: string;
}

function mapTeam(t: TeamRow) {
  return {
    id: t.id,
    name: t.name,
    slug: t.slug,
    description: t.description,
    color: t.color,
    icon: t.icon,
    rules: Array.isArray(t.rules) ? t.rules : [],
    constraints: Array.isArray(t.constraints) ? t.constraints : [],
    agentCount: t.agent_count ? parseInt(t.agent_count, 10) : undefined,
  };
}

async function loadTeamBySlug(slug: string) {
  const result = await query<TeamRow>(
    `SELECT tg.*, COUNT(a.id)::text AS agent_count
     FROM team_groups tg
     LEFT JOIN agents a ON a.team_group_id = tg.id
     WHERE tg.slug = $1
     GROUP BY tg.id`,
    [slug]
  );
  return result.rows[0] ?? null;
}

async function loadTeamProjects(teamId: string) {
  const result = await query<TeamProjectRow>(
    `SELECT p.id, p.title, p.description, p.status,
            COUNT(DISTINCT pa.agent_id)::text AS team_agent_count,
            wp.id AS work_project_id
     FROM projects p
     JOIN project_agents pa ON pa.project_id = p.id
     JOIN agents a ON a.id = pa.agent_id AND a.team_group_id = $1
     LEFT JOIN work_projects wp ON wp.project_group_id = p.id
     GROUP BY p.id, wp.id
     ORDER BY p.title`,
    [teamId]
  );
  return result.rows.map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    status: p.status,
    teamAgentCount: parseInt(p.team_agent_count, 10),
    workProjectId: p.work_project_id,
  }));
}

async function loadToolRequests(teamId: string) {
  const result = await query<ToolRequestRow>(
    `SELECT tr.*, p.title AS project_title, u.name AS requester_name
     FROM team_tool_requests tr
     LEFT JOIN projects p ON p.id = tr.project_id
     LEFT JOIN users u ON u.id = tr.requested_by
     WHERE tr.team_group_id = $1
     ORDER BY tr.created_at DESC`,
    [teamId]
  );
  return result.rows.map((r) => ({
    id: r.id,
    teamGroupId: r.team_group_id,
    projectId: r.project_id,
    projectTitle: r.project_title,
    toolName: r.tool_name,
    category: r.category,
    reason: r.reason,
    url: r.url,
    status: r.status as "requested" | "approved" | "rejected" | "provisioned",
    requestedBy: r.requested_by,
    requesterName: r.requester_name,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
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
      ...mapTeam(t),
      agentCount: parseInt(t.agent_count!, 10),
    })),
  });
});

router.get("/:slug", authRequired, async (req, res) => {
  const team = await loadTeamBySlug(routeParam(req.params.slug));
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

  const [projects, toolRequests] = await Promise.all([
    loadTeamProjects(team.id),
    loadToolRequests(team.id),
  ]);

  res.json({
    team: mapTeam(team),
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
    projects,
    toolRequests,
  });
});

router.patch("/:slug", authRequired, async (req, res) => {
  const team = await loadTeamBySlug(routeParam(req.params.slug));
  if (!team) {
    res.status(404).json({ error: "Team not found" });
    return;
  }

  if (!(await canAccessTeam(req.user!, team.id))) {
    res.status(403).json({ error: "You do not have access to this team" });
    return;
  }

  const { description, rules, constraints } = req.body as {
    description?: string | null;
    rules?: string[];
    constraints?: string[];
  };

  const sets: string[] = [];
  const values: unknown[] = [team.id];
  let idx = 2;

  if (description !== undefined) {
    sets.push(`description = $${idx++}`);
    values.push(description);
  }
  if (rules !== undefined) {
    sets.push(`rules = $${idx++}`);
    values.push(JSON.stringify(rules));
  }
  if (constraints !== undefined) {
    sets.push(`constraints = $${idx++}`);
    values.push(JSON.stringify(constraints));
  }

  if (sets.length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const result = await query<TeamRow>(
    `UPDATE team_groups SET ${sets.join(", ")} WHERE id = $1 RETURNING *`,
    values
  );

  const updated = result.rows[0];
  res.json({
    team: {
      ...mapTeam(updated),
      agentCount: team.agent_count ? parseInt(team.agent_count, 10) : 0,
    },
  });
});

router.post("/:slug/tool-requests", authRequired, async (req, res) => {
  const team = await loadTeamBySlug(routeParam(req.params.slug));
  if (!team) {
    res.status(404).json({ error: "Team not found" });
    return;
  }

  if (!(await canAccessTeam(req.user!, team.id))) {
    res.status(403).json({ error: "You do not have access to this team" });
    return;
  }

  const { projectId, toolName, category, reason, url } = req.body as {
    projectId?: string;
    toolName?: string;
    category?: string;
    reason?: string;
    url?: string;
  };

  if (!toolName?.trim()) {
    res.status(400).json({ error: "Tool name is required" });
    return;
  }

  if (projectId) {
    const projectCheck = await query<{ id: string }>(
      `SELECT p.id
       FROM projects p
       JOIN project_agents pa ON pa.project_id = p.id
       JOIN agents a ON a.id = pa.agent_id AND a.team_group_id = $1
       WHERE p.id = $2
       LIMIT 1`,
      [team.id, projectId]
    );
    if (projectCheck.rows.length === 0) {
      res.status(400).json({ error: "Project is not assigned to this team" });
      return;
    }
  }

  const result = await query<ToolRequestRow>(
    `INSERT INTO team_tool_requests
       (team_group_id, project_id, tool_name, category, reason, url, requested_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      team.id,
      projectId ?? null,
      toolName.trim(),
      category?.trim() || "other",
      reason?.trim() || null,
      url?.trim() || null,
      req.user!.id,
    ]
  );

  const row = result.rows[0];
  const projectTitle = projectId
    ? (
        await query<{ title: string }>("SELECT title FROM projects WHERE id = $1", [projectId])
      ).rows[0]?.title ?? null
    : null;

  res.status(201).json({
    request: {
      id: row.id,
      teamGroupId: row.team_group_id,
      projectId: row.project_id,
      projectTitle,
      toolName: row.tool_name,
      category: row.category,
      reason: row.reason,
      url: row.url,
      status: row.status as "requested",
      requestedBy: row.requested_by,
      requesterName: req.user!.name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
  });
});

router.patch("/:slug/tool-requests/:requestId", authRequired, async (req, res) => {
  const team = await loadTeamBySlug(routeParam(req.params.slug));
  if (!team) {
    res.status(404).json({ error: "Team not found" });
    return;
  }

  if (!(await canAccessTeam(req.user!, team.id))) {
    res.status(403).json({ error: "You do not have access to this team" });
    return;
  }

  const { status } = req.body as { status?: string };
  const validStatuses = ["requested", "approved", "rejected", "provisioned"];
  if (!status || !validStatuses.includes(status)) {
    res.status(400).json({ error: "Valid status is required" });
    return;
  }

  if (req.user!.role !== "admin" && status !== "requested") {
    res.status(403).json({ error: "Only admins can update request status" });
    return;
  }

  const result = await query<ToolRequestRow>(
    `UPDATE team_tool_requests
     SET status = $3, updated_at = NOW()
     WHERE id = $1 AND team_group_id = $2
     RETURNING *`,
    [routeParam(req.params.requestId), team.id, status]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: "Tool request not found" });
    return;
  }

  const row = result.rows[0];
  const meta = await query<{ project_title: string | null; requester_name: string | null }>(
    `SELECT p.title AS project_title, u.name AS requester_name
     FROM team_tool_requests tr
     LEFT JOIN projects p ON p.id = tr.project_id
     LEFT JOIN users u ON u.id = tr.requested_by
     WHERE tr.id = $1`,
    [row.id]
  );

  res.json({
    request: {
      id: row.id,
      teamGroupId: row.team_group_id,
      projectId: row.project_id,
      projectTitle: meta.rows[0]?.project_title ?? null,
      toolName: row.tool_name,
      category: row.category,
      reason: row.reason,
      url: row.url,
      status: row.status as "requested" | "approved" | "rejected" | "provisioned",
      requestedBy: row.requested_by,
      requesterName: meta.rows[0]?.requester_name ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
  });
});

router.delete("/:slug/tool-requests/:requestId", authRequired, async (req, res) => {
  const team = await loadTeamBySlug(routeParam(req.params.slug));
  if (!team) {
    res.status(404).json({ error: "Team not found" });
    return;
  }

  if (!(await canAccessTeam(req.user!, team.id))) {
    res.status(403).json({ error: "You do not have access to this team" });
    return;
  }

  const result = await query(
    `DELETE FROM team_tool_requests WHERE id = $1 AND team_group_id = $2 RETURNING id`,
    [routeParam(req.params.requestId), team.id]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: "Tool request not found" });
    return;
  }

  res.json({ deleted: true });
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
      ...mapTeam(t),
      agentCount: 0,
    },
  });
});

export default router;
