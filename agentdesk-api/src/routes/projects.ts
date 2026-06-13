import { Router } from "express";
import { query } from "../db.js";
import { authRequired } from "../middleware/auth.js";
import { getAccessibleProjectIds, canAccessProject } from "../services/access.js";
import {
  deleteWorkProjectForGroup,
  ensureWorkProjectGroupsLinked,
  getWorkProjectIdForGroup,
} from "../services/workProjectGroups.js";

const router = Router();

router.get("/", authRequired, async (req, res) => {
  try {
    await ensureWorkProjectGroupsLinked();

    const accessible = await getAccessibleProjectIds(req.user!);
    const params: unknown[] = [];
    let where = "";
    if (accessible !== null) {
      if (accessible.length === 0) {
        res.json({ projects: [] });
        return;
      }
      params.push(accessible);
      where = ` WHERE p.id = ANY($${params.length}::uuid[])`;
    }

    const result = await query<{
      id: string;
      title: string;
      goal: string | null;
      description: string | null;
      status: string;
      created_at: string;
      agent_count: string;
      work_project_id: string | null;
    }>(
      `SELECT p.*, COUNT(pa.id)::text AS agent_count, wp.id AS work_project_id
       FROM projects p
       LEFT JOIN project_agents pa ON pa.project_id = p.id
       LEFT JOIN work_projects wp ON wp.project_group_id = p.id
       ${where}
       GROUP BY p.id, wp.id
       ORDER BY p.created_at DESC`,
      params
    );

    res.json({
      projects: result.rows.map((p) => ({
        id: p.id,
        title: p.title,
        goal: p.goal,
        description: p.description,
        status: p.status ?? "active",
        createdAt: p.created_at,
        agentCount: parseInt(p.agent_count, 10),
        workProjectId: p.work_project_id,
      })),
    });
  } catch (error) {
    console.error("List projects failed:", error);
    const fallback = await query<{
      id: string;
      title: string;
      goal: string | null;
      description: string | null;
      created_at: string;
    }>("SELECT id, title, goal, description, created_at FROM projects ORDER BY created_at DESC");

    res.json({
      projects: fallback.rows.map((p) => ({
        id: p.id,
        title: p.title,
        goal: p.goal,
        description: p.description,
        status: "active",
        createdAt: p.created_at,
        agentCount: 0,
      })),
    });
  }
});

router.get("/:id", authRequired, async (req, res) => {
  const projectResult = await query<{
    id: string;
    title: string;
    goal: string | null;
    description: string | null;
    status: string;
    created_at: string;
  }>("SELECT * FROM projects WHERE id = $1", [req.params.id]);

  const project = projectResult.rows[0];
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  if (!(await canAccessProject(req.user!, project.id))) {
    res.status(403).json({ error: "You do not have access to this project group" });
    return;
  }

  const agentsResult = await query<{
    membership_id: string;
    role: string;
    skills: string[];
    rules: string[];
    constraints: string[];
    agent_id: string;
    slug: string;
    name: string;
    team: string;
    avatar_color: string | null;
    is_template: boolean;
    parent_agent_name: string | null;
    agent_short_id: string;
    other_project_count: string;
    team_group_slug: string | null;
    team_group_name: string | null;
    team_group_color: string | null;
  }>(
    `SELECT pa.id AS membership_id, pa.role, pa.skills, pa.rules, pa.constraints,
            a.id AS agent_id, a.slug, a.name, a.team, a.avatar_color, a.is_template,
            parent.name AS parent_agent_name,
            LEFT(a.id::text, 8) AS agent_short_id,
            (SELECT COUNT(*)::text FROM project_agents pa2
             WHERE pa2.agent_id = a.id AND pa2.project_id != $1) AS other_project_count,
            tg.slug AS team_group_slug, tg.name AS team_group_name, tg.color AS team_group_color
     FROM project_agents pa
     JOIN agents a ON a.id = pa.agent_id
     LEFT JOIN agents parent ON parent.id = a.parent_agent_id
     LEFT JOIN team_groups tg ON tg.id = a.team_group_id
     WHERE pa.project_id = $1
     ORDER BY pa.added_at`,
    [project.id]
  );

  const workProjectId = await getWorkProjectIdForGroup(project.id);

  res.json({
    project: {
      id: project.id,
      title: project.title,
      goal: project.goal,
      description: project.description,
      status: project.status,
      createdAt: project.created_at,
      workProjectId,
    },
    agents: agentsResult.rows.map((a) => ({
      membershipId: a.membership_id,
      role: a.role,
      skills: a.skills,
      rules: a.rules,
      constraints: a.constraints,
      agentId: a.agent_id,
      slug: a.slug,
      name: a.name,
      team: a.team,
      avatarColor: a.avatar_color,
      shortId: a.agent_short_id,
      isTemplate: a.is_template,
      isClone: !!a.parent_agent_name,
      parentAgentName: a.parent_agent_name,
      otherProjectCount: parseInt(a.other_project_count, 10),
      teamGroup: a.team_group_slug
        ? { slug: a.team_group_slug, name: a.team_group_name, color: a.team_group_color }
        : null,
    })),
  });
});

router.post("/", authRequired, async (req, res) => {
  const { title, goal, description, agentIds } = req.body as {
    title?: string;
    goal?: string;
    description?: string;
    agentIds?: string[];
  };

  if (!title?.trim()) {
    res.status(400).json({ error: "Project title is required" });
    return;
  }

  try {
    const projectResult = await query<{ id: string }>(
      `INSERT INTO projects (title, goal, description, status, created_by)
       VALUES ($1, $2, $3, 'active', $4) RETURNING id`,
      [title.trim(), goal ?? null, description ?? null, req.user!.id]
    );

    const projectId = projectResult.rows[0].id;

    if (agentIds?.length) {
      for (const agentId of agentIds) {
        const agent = await query<{ skills: unknown; rules: unknown; constraints: unknown }>(
          "SELECT skills, rules, constraints FROM agents WHERE id = $1",
          [agentId]
        );
        const a = agent.rows[0];
        if (a) {
          const skills = typeof a.skills === "string" ? a.skills : JSON.stringify(a.skills ?? []);
          const rules = typeof a.rules === "string" ? a.rules : JSON.stringify(a.rules ?? []);
          const constraints =
            typeof a.constraints === "string" ? a.constraints : JSON.stringify(a.constraints ?? []);

          await query(
            `INSERT INTO project_agents (project_id, agent_id, skills, rules, constraints)
             VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb) ON CONFLICT DO NOTHING`,
            [projectId, agentId, skills, rules, constraints]
          );
        }
      }
    }

    res.status(201).json({ projectId });
  } catch (error) {
    console.error("Create project failed:", error);
    const message = error instanceof Error ? error.message : "Failed to create project group";
    res.status(500).json({ error: message });
  }
});

router.post("/:id/agents", authRequired, async (req, res) => {
  const { agentId, role, skills, rules, constraints } = req.body as {
    agentId?: string;
    role?: string;
    skills?: string[];
    rules?: string[];
    constraints?: string[];
  };

  if (!agentId) {
    res.status(400).json({ error: "agentId is required" });
    return;
  }

  const agent = await query<{ skills: string[]; rules: string[]; constraints: string[] }>(
    "SELECT skills, rules, constraints FROM agents WHERE id = $1",
    [agentId]
  );
  const a = agent.rows[0];
  if (!a) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  await query(
    `INSERT INTO project_agents (project_id, agent_id, role, skills, rules, constraints)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (project_id, agent_id) DO UPDATE SET
       role = EXCLUDED.role,
       skills = EXCLUDED.skills,
       rules = EXCLUDED.rules,
       constraints = EXCLUDED.constraints`,
    [
      req.params.id,
      agentId,
      role ?? "contributor",
      JSON.stringify(skills ?? a.skills),
      JSON.stringify(rules ?? a.rules),
      JSON.stringify(constraints ?? a.constraints),
    ]
  );

  res.status(201).json({ added: true });
});

router.patch("/:id/agents/:agentId", authRequired, async (req, res) => {
  const { role, skills, rules, constraints } = req.body as {
    role?: string;
    skills?: string[];
    rules?: string[];
    constraints?: string[];
  };

  const result = await query(
    `UPDATE project_agents SET
      role = COALESCE($3, role),
      skills = COALESCE($4::jsonb, skills),
      rules = COALESCE($5::jsonb, rules),
      constraints = COALESCE($6::jsonb, constraints)
     WHERE project_id = $1 AND agent_id = $2
     RETURNING id`,
    [
      req.params.id,
      req.params.agentId,
      role ?? null,
      skills ? JSON.stringify(skills) : null,
      rules ? JSON.stringify(rules) : null,
      constraints ? JSON.stringify(constraints) : null,
    ]
  );

  if (!result.rowCount) {
    res.status(404).json({ error: "Project agent not found" });
    return;
  }

  res.json({ updated: true });
});

router.delete("/:id/agents/:agentId", authRequired, async (req, res) => {
  await query("DELETE FROM project_agents WHERE project_id = $1 AND agent_id = $2", [
    req.params.id,
    req.params.agentId,
  ]);
  res.json({ removed: true });
});

router.patch("/:id", authRequired, async (req, res) => {
  const { title, goal, description, status } = req.body as {
    title?: string;
    goal?: string;
    description?: string;
    status?: string;
  };

  const result = await query<{ id: string }>(
    `UPDATE projects SET
      title = COALESCE($2, title),
      goal = COALESCE($3, goal),
      description = COALESCE($4, description),
      status = COALESCE($5, status),
      updated_at = NOW()
    WHERE id = $1 RETURNING id`,
    [req.params.id, title ?? null, goal ?? null, description ?? null, status ?? null]
  );

  if (!result.rows[0]) {
    res.status(404).json({ error: "Project group not found" });
    return;
  }

  const workProjectId = await getWorkProjectIdForGroup(req.params.id);
  if (workProjectId && (title !== undefined || description !== undefined || status !== undefined)) {
    await query(
      `UPDATE work_projects SET
        title = COALESCE($2, title),
        description = COALESCE($3, description),
        status = COALESCE($4, status),
        updated_at = NOW()
       WHERE id = $1`,
      [
        workProjectId,
        title?.trim() ?? null,
        description?.trim() ?? null,
        status ?? null,
      ]
    );
  }

  res.json({ updated: true });
});

router.delete("/:id", authRequired, async (req, res) => {
  await deleteWorkProjectForGroup(req.params.id);
  await query("DELETE FROM projects WHERE id = $1", [req.params.id]);
  res.json({ deleted: true });
});

export default router;
