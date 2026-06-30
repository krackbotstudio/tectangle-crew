import { Router, type Request } from "express";
import { query } from "../db.js";
import { authRequired } from "../middleware/auth.js";
import { canUseAgentTemplate } from "../services/agentTemplates.js";
import { getAccessibleProjectIds, canAccessProject } from "../services/access.js";
import {
  deleteWorkProjectForGroup,
  ensureWorkProjectGroupsLinked,
  getWorkProjectIdForGroup,
} from "../services/workProjectGroups.js";
import {
  addProjectTool,
  applyToolStack,
  listProjectTools,
  removeProjectTool,
  updateProjectTool,
} from "../services/projectTools.js";
import { getCatalogTool } from "../services/toolCatalog.js";
import type { ProjectToolStatus } from "../services/toolCatalog.js";
import {
  instantiateAgentForProject,
  repairTemplateProjectLinks,
  deleteProjectAgentInstance,
} from "../services/projectAgentInstances.js";
import { routeParam } from "../utils/routeParam.js";
import { loadAiConfig } from "../services/aiSettings.js";
import { generateDirectAgentReply } from "../services/llmClient.js";
import fs from "fs";

function debugLog(msg: string) {
  try {
    fs.appendFileSync("e:/Business Projects/agentdesk-agenthub to run your business/debug_projects.log", `[${new Date().toISOString()}] ${msg}\n`);
  } catch (err) {
    console.error("Failed to write debug log", err);
  }
}

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
      agents: Array<{ slug: string; name: string; avatarColor: string | null }> | null;
    }>(
      `SELECT p.id, p.title, p.goal, p.description, p.status, p.created_at,
              COUNT(DISTINCT pa.id)::text AS agent_count,
              wp.id AS work_project_id,
              COALESCE(
                (
                  SELECT json_agg(
                    json_build_object(
                      'slug', a.slug,
                      'name', a.name,
                      'avatarColor', a.avatar_color
                    )
                    ORDER BY pa2.added_at
                  )
                  FROM project_agents pa2
                  JOIN agents a ON a.id = pa2.agent_id
                  WHERE pa2.project_id = p.id
                ),
                '[]'::json
              ) AS agents
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
        agents: (p.agents ?? []).map((a) => ({
          slug: a.slug,
          name: a.name,
          avatarColor: a.avatarColor,
        })),
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
        agents: [],
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
  }>("SELECT * FROM projects WHERE id = $1", [routeParam(req.params.id)]);

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
    parent_agent_id: string | null;
    parent_agent_name: string | null;
    agent_short_id: string;
    other_project_count: string;
    team_group_slug: string | null;
    team_group_name: string | null;
    team_group_color: string | null;
  }>(
    `SELECT pa.id AS membership_id, pa.role, pa.skills, pa.rules, pa.constraints,
            a.id AS agent_id, a.slug, a.name, a.team, a.avatar_color, a.is_template,
            a.parent_agent_id,
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
      isTemplate: false,
      isProjectAgent: true,
      isClone: !!a.parent_agent_id,
      parentAgentName: a.parent_agent_name,
      templateAgentId: a.parent_agent_id,
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

  debugLog(`POST / body: ${JSON.stringify(req.body)}`);

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
    debugLog(`Created project, id: ${projectId}`);

    if (agentIds?.length) {
      for (const agentId of agentIds) {
        if (!(await canUseAgentTemplate(agentId, req.user!.id))) {
          debugLog(`Skipping template ${agentId} — no access`);
          continue;
        }
        debugLog(`Instantiating agent from template: ${agentId}`);
        const instance = await instantiateAgentForProject({
          sourceAgentId: agentId,
          projectId,
        });

        const agent = await query<{ skills: unknown; rules: unknown; constraints: unknown }>(
          "SELECT skills, rules, constraints FROM agents WHERE id = $1",
          [instance.agentId]
        );
        const a = agent.rows[0];
        if (a) {
          const skills = typeof a.skills === "string" ? a.skills : JSON.stringify(a.skills ?? []);
          const rules = typeof a.rules === "string" ? a.rules : JSON.stringify(a.rules ?? []);
          const constraints =
            typeof a.constraints === "string" ? a.constraints : JSON.stringify(a.constraints ?? []);

          const insertRes = await query(
            `INSERT INTO project_agents (project_id, agent_id, skills, rules, constraints)
             VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb) ON CONFLICT DO NOTHING`,
            [projectId, instance.agentId, skills, rules, constraints]
          );
          debugLog(`Inserted project instance ${instance.slug}, rows affected: ${insertRes.rowCount}`);
        }
      }
    }

    res.status(201).json({ projectId });
  } catch (error) {
    debugLog(`Create project failed with error: ${error instanceof Error ? error.stack : String(error)}`);
    console.error("Create project failed:", error);
    const message = error instanceof Error ? error.message : "Failed to create project group";
    res.status(500).json({ error: message });
  }
});

function extractJson(text: string): string {
  const clean = text.trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return clean.slice(start, end + 1);
  }
  return clean;
}

router.post("/ai-setup", authRequired, async (req, res) => {
  const { description } = req.body as { description?: string };
  if (!description?.trim()) {
    res.status(400).json({ error: "Project description is required" });
    return;
  }

  try {
    const agentsResult = await query<{
      id: string;
      name: string;
      slug: string;
      description: string | null;
    }>("SELECT id, name, slug, description FROM agents WHERE slug != 'orchestrator' AND is_active = true");
    
    const availableAgents = agentsResult.rows;
    const agentListText = availableAgents
      .map((a) => `- ${a.name} (ID: ${a.id}): ${a.description || "No description provided."}`)
      .join("\n");

    const systemPrompt = `You are an expert AI Project Manager. Your job is to analyze a project description and output a detailed setup configuration for a multi-agent project group.
You MUST output a single valid JSON object and absolutely nothing else. Do not wrap it in markdown code blocks or add any comments/explanation.

Expected JSON format:
{
  "title": "Suggested Project Group Name",
  "goal": "Suggested Project Group Goal",
  "description": "Suggested Project Group Description",
  "agents": [
    {
      "agentId": "The ID of the recommended agent",
      "role": "Tailored role for this agent for this project",
      "skills": ["Tailored skill 1", "Tailored skill 2"],
      "rules": ["Tailored rule 1", "Tailored rule 2"]
    }
  ]
}

Available Agent Templates:
${agentListText}

Only recommend agents from the list above. Do not invent new agent IDs. Suggest only the agents that are relevant and necessary for the project.`;

    const aiConfig = await loadAiConfig();
    const result = await generateDirectAgentReply({
      aiConfig,
      agent: {
        llm_provider: null,
        llm_model: null,
        llm_temperature: 0.2,
      },
      systemPrompt,
      history: [],
      userMessage: `Please generate a setup recommendation for the following project description:\n\n${description.trim()}`,
    });

    debugLog("AI Recommendation reply: " + result.reply);

    const cleanJson = extractJson(result.reply);
    const recommendation = JSON.parse(cleanJson);
    res.json(recommendation);
  } catch (error) {
    console.error("AI Setup failed:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to generate AI setup recommendation" });
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

  const projectId = routeParam(req.params.id);
  const projectResult = await query<{ title: string }>("SELECT title FROM projects WHERE id = $1", [
    projectId,
  ]);
  const projectTitle = projectResult.rows[0]?.title;

  if (!(await canUseAgentTemplate(agentId, req.user!.id))) {
    res.status(403).json({ error: "You do not have access to this private template" });
    return;
  }

  const instance = await instantiateAgentForProject({
    sourceAgentId: agentId,
    projectId,
    projectTitle,
    skills,
    rules,
    constraints,
  });

  const agent = await query<{ skills: string[]; rules: string[]; constraints: string[] }>(
    "SELECT skills, rules, constraints FROM agents WHERE id = $1",
    [instance.agentId]
  );
  const a = agent.rows[0];
  if (!a) {
    res.status(404).json({ error: "Agent instance could not be created" });
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
      projectId,
      instance.agentId,
      role ?? "contributor",
      JSON.stringify(skills ?? a.skills),
      JSON.stringify(rules ?? a.rules),
      JSON.stringify(constraints ?? a.constraints),
    ]
  );

  res.status(201).json({
    added: true,
    agentId: instance.agentId,
    slug: instance.slug,
    name: instance.name,
  });
});

router.patch("/:id/agents/:agentId", authRequired, async (req, res) => {
  const { role, skills, rules, constraints } = req.body as {
    role?: string;
    skills?: string[];
    rules?: string[];
    constraints?: string[];
  };

  const pId = routeParam(req.params.id);
  const aId = routeParam(req.params.agentId);
  debugLog(`PATCH /${pId}/agents/${aId} body: ${JSON.stringify(req.body)}`);

  const result = await query(
    `UPDATE project_agents SET
      role = COALESCE($3, role),
      skills = COALESCE($4::jsonb, skills),
      rules = COALESCE($5::jsonb, rules),
      constraints = COALESCE($6::jsonb, constraints)
     WHERE project_id = $1 AND agent_id = $2
     RETURNING id`,
    [
      pId,
      aId,
      role ?? null,
      skills ? JSON.stringify(skills) : null,
      rules ? JSON.stringify(rules) : null,
      constraints ? JSON.stringify(constraints) : null,
    ]
  );

  const rowsAffected = result.rowCount ?? (result as any).affectedRows ?? result.rows.length;
  debugLog(`PATCH update rows affected: ${rowsAffected}`);

  if (!rowsAffected) {
    res.status(404).json({ error: "Project agent not found" });
    return;
  }

  res.json({ updated: true });
});

router.delete("/:id/agents/:agentId", authRequired, async (req, res) => {
  const projectId = routeParam(req.params.id);
  const agentId = routeParam(req.params.agentId);

  await query("DELETE FROM project_agents WHERE project_id = $1 AND agent_id = $2", [
    projectId,
    agentId,
  ]);
  await deleteProjectAgentInstance(agentId);
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
    [routeParam(req.params.id), title ?? null, goal ?? null, description ?? null, status ?? null]
  );

  if (!result.rows[0]) {
    res.status(404).json({ error: "Project group not found" });
    return;
  }

  const workProjectId = await getWorkProjectIdForGroup(routeParam(req.params.id));
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

async function requireProjectAccess(req: Request, projectId: string) {
  if (!(await canAccessProject(req.user!, projectId))) {
    return false;
  }
  return true;
}

router.get("/:id/tools", authRequired, async (req, res) => {
  const projectId = routeParam(req.params.id);
  if (!(await requireProjectAccess(req, projectId))) {
    res.status(403).json({ error: "You do not have access to this project group" });
    return;
  }
  const tools = await listProjectTools(projectId);
  res.json({ tools });
});

router.post("/:id/tools", authRequired, async (req, res) => {
  const projectId = routeParam(req.params.id);
  if (!(await requireProjectAccess(req, projectId))) {
    res.status(403).json({ error: "You do not have access to this project group" });
    return;
  }

  const { toolSlug, stackId, status, notes } = req.body as {
    toolSlug?: string;
    stackId?: string;
    status?: string;
    notes?: string;
  };

  if (stackId) {
    try {
      const tools = await applyToolStack(projectId, stackId, req.user!.id);
      res.status(201).json({ tools });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Invalid stack" });
    }
    return;
  }

  if (!toolSlug) {
    res.status(400).json({ error: "toolSlug or stackId is required" });
    return;
  }

  const catalog = getCatalogTool(toolSlug);
  if (!catalog) {
    res.status(400).json({ error: "Unknown tool" });
    return;
  }

  const tool = await addProjectTool(projectId, catalog, {
    status: (status as ProjectToolStatus) ?? "planned",
    notes: notes?.trim(),
    addedBy: req.user!.id,
  });
  res.status(201).json({ tool });
});

router.patch("/:id/tools/:toolId", authRequired, async (req, res) => {
  const projectId = routeParam(req.params.id);
  const toolId = routeParam(req.params.toolId);
  if (!(await requireProjectAccess(req, projectId))) {
    res.status(403).json({ error: "You do not have access to this project group" });
    return;
  }

  const { status, notes, config } = req.body as {
    status?: string;
    notes?: string | null;
    config?: Record<string, unknown>;
  };

  const tool = await updateProjectTool(projectId, toolId, {
    status: status as ProjectToolStatus | undefined,
    notes,
    config,
  });
  if (!tool) {
    res.status(404).json({ error: "Tool not found" });
    return;
  }
  res.json({ tool });
});

router.delete("/:id/tools/:toolId", authRequired, async (req, res) => {
  const projectId = routeParam(req.params.id);
  const toolId = routeParam(req.params.toolId);
  if (!(await requireProjectAccess(req, projectId))) {
    res.status(403).json({ error: "You do not have access to this project group" });
    return;
  }
  const deleted = await removeProjectTool(projectId, toolId);
  if (!deleted) {
    res.status(404).json({ error: "Tool not found" });
    return;
  }
  res.json({ deleted: true });
});

router.delete("/:id", authRequired, async (req, res) => {
  await deleteWorkProjectForGroup(routeParam(req.params.id));
  await query("DELETE FROM projects WHERE id = $1", [routeParam(req.params.id)]);
  res.json({ deleted: true });
});

export default router;
