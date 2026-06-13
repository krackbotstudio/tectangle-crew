import { Router } from "express";
import { query } from "../db.js";
import { authRequired, adminRequired } from "../middleware/auth.js";
import { config } from "../config.js";
import agentBoardRoutes from "./agentBoard.js";

const router = Router();

export interface AgentRow {
  id: string;
  slug: string;
  name: string;
  team: string;
  webhook_url: string | null;
  chat_webhook_path: string | null;
  workflow_id: string | null;
  system_prompt: string | null;
  knowledge_collection_id: string | null;
  connected_apps: string[];
  is_active: boolean;
  team_group_id: string | null;
  parent_agent_id: string | null;
  description: string | null;
  skills: string[];
  rules: string[];
  constraints: string[];
  avatar_color: string | null;
  is_template: boolean;
  team_group_slug?: string | null;
  team_group_name?: string | null;
  team_group_color?: string | null;
  parent_agent_name?: string | null;
}

async function getAgentProjectGroups(agentId: string) {
  const result = await query<{ id: string; title: string }>(
    `SELECT p.id, p.title FROM projects p
     JOIN project_agents pa ON pa.project_id = p.id
     WHERE pa.agent_id = $1 ORDER BY p.title`,
    [agentId]
  );
  return result.rows.map((p) => ({ id: p.id, title: p.title }));
}

function mapAgent(row: AgentRow, projectGroups?: { id: string; title: string }[]) {
  const n8nWebhookUrl =
    row.webhook_url ||
    (row.chat_webhook_path
      ? `${config.n8nBaseUrl}/webhook/${row.chat_webhook_path}`
      : null);

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    team: row.team,
    webhookUrl: n8nWebhookUrl,
    chatWebhookPath: row.chat_webhook_path,
    workflowId: row.workflow_id,
    systemPrompt: row.system_prompt,
    knowledgeCollectionId: row.knowledge_collection_id,
    connectedApps: row.connected_apps,
    isActive: row.is_active,
    teamGroupId: row.team_group_id,
    parentAgentId: row.parent_agent_id,
    description: row.description,
    skills: row.skills ?? [],
    rules: row.rules ?? [],
    constraints: row.constraints ?? [],
    avatarColor: row.avatar_color ?? "#6366f1",
    isTemplate: row.is_template,
    isClone: !!row.parent_agent_id,
    parentAgentName: row.parent_agent_name ?? null,
    shortId: row.id.slice(0, 8),
    projectGroups: projectGroups ?? [],
    teamGroup: row.team_group_slug
      ? { slug: row.team_group_slug, name: row.team_group_name, color: row.team_group_color }
      : null,
  };
}

const agentSelect = `
  SELECT a.*, tg.slug AS team_group_slug, tg.name AS team_group_name, tg.color AS team_group_color,
         parent.name AS parent_agent_name
  FROM agents a
  LEFT JOIN team_groups tg ON tg.id = a.team_group_id
  LEFT JOIN agents parent ON parent.id = a.parent_agent_id
`;

router.get("/", authRequired, async (req, res) => {
  const { teamGroupId } = req.query;
  let sql = `${agentSelect} WHERE 1=1`;
  const params: unknown[] = [];

  if (teamGroupId) {
    params.push(teamGroupId);
    sql += ` AND a.team_group_id = $${params.length}`;
  }

  sql += ` ORDER BY a.is_template DESC, a.team, a.name`;

  const result = await query<AgentRow>(sql, params);
  res.json({
    agents: await Promise.all(
      result.rows.map(async (row) => mapAgent(row, await getAgentProjectGroups(row.id)))
    ),
  });
});

router.use("/:slug/board", agentBoardRoutes);

router.get("/:slug", authRequired, async (req, res) => {
  const result = await query<AgentRow>(`${agentSelect} WHERE a.slug = $1`, [req.params.slug]);
  const agent = result.rows[0];
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }
  const projectGroups = await getAgentProjectGroups(agent.id);
  res.json({ agent: mapAgent(agent, projectGroups) });
});

router.post("/:slug/clone", authRequired, async (req, res) => {
  const source = await query<AgentRow>(`${agentSelect} WHERE a.slug = $1`, [req.params.slug]);
  const src = source.rows[0];
  if (!src) {
    res.status(404).json({ error: "Source agent not found" });
    return;
  }

  const { name, description, teamGroupId, skills, rules, constraints } = req.body as {
    name?: string;
    description?: string;
    teamGroupId?: string;
    skills?: string[];
    rules?: string[];
    constraints?: string[];
  };

  const cloneName = name?.trim() || `${src.name} (Copy)`;
  const baseSlug = cloneName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const slug = `${baseSlug}-${Date.now().toString(36)}`;

  const result = await query<AgentRow>(
    `INSERT INTO agents (
      slug, name, team, webhook_url, chat_webhook_path, workflow_id, system_prompt,
      knowledge_collection_id, connected_apps, is_active, team_group_id, parent_agent_id,
      description, skills, rules, constraints, avatar_color, is_template
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,false,$10,$11,$12,$13,$14,$15,$16,false)
    RETURNING *`,
    [
      slug,
      cloneName,
      src.team,
      src.webhook_url,
      src.chat_webhook_path,
      src.workflow_id,
      src.system_prompt,
      `${slug}-kb`,
      JSON.stringify(src.connected_apps),
      teamGroupId ?? src.team_group_id,
      src.id,
      description ?? src.description,
      JSON.stringify(skills ?? src.skills),
      JSON.stringify(rules ?? src.rules),
      JSON.stringify(constraints ?? src.constraints),
      src.avatar_color,
    ]
  );

  const withTeam = await query<AgentRow>(`${agentSelect} WHERE a.id = $1`, [result.rows[0].id]);
  const projectGroups = await getAgentProjectGroups(withTeam.rows[0].id);
  res.status(201).json({ agent: mapAgent(withTeam.rows[0], projectGroups) });
});

router.patch("/:slug", authRequired, async (req, res) => {
  const {
    webhookUrl,
    chatWebhookPath,
    workflowId,
    systemPrompt,
    isActive,
    connectedApps,
    name,
    description,
    teamGroupId,
    skills,
    rules,
    constraints,
    avatarColor,
  } = req.body as {
    webhookUrl?: string;
    chatWebhookPath?: string;
    workflowId?: string;
    systemPrompt?: string;
    isActive?: boolean;
    connectedApps?: string[];
    name?: string;
    description?: string;
    teamGroupId?: string | null;
    skills?: string[];
    rules?: string[];
    constraints?: string[];
    avatarColor?: string;
  };

  const isAdmin = req.user?.role === "admin";
  const sensitiveFields =
    webhookUrl !== undefined ||
    chatWebhookPath !== undefined ||
    workflowId !== undefined ||
    isActive !== undefined;

  if (sensitiveFields && !isAdmin) {
    res.status(403).json({ error: "Admin access required for webhook settings" });
    return;
  }

  const result = await query<AgentRow>(
    `UPDATE agents SET
      webhook_url = COALESCE($2, webhook_url),
      chat_webhook_path = COALESCE($3, chat_webhook_path),
      workflow_id = COALESCE($4, workflow_id),
      system_prompt = COALESCE($5, system_prompt),
      is_active = COALESCE($6, is_active),
      connected_apps = COALESCE($7::jsonb, connected_apps),
      name = COALESCE($8, name),
      description = COALESCE($9, description),
      team_group_id = COALESCE($10, team_group_id),
      skills = COALESCE($11::jsonb, skills),
      rules = COALESCE($12::jsonb, rules),
      constraints = COALESCE($13::jsonb, constraints),
      avatar_color = COALESCE($14, avatar_color),
      updated_at = NOW()
    WHERE slug = $1
    RETURNING *`,
    [
      req.params.slug,
      webhookUrl ?? null,
      chatWebhookPath ?? null,
      workflowId ?? null,
      systemPrompt ?? null,
      isActive ?? null,
      connectedApps ? JSON.stringify(connectedApps) : null,
      name ?? null,
      description ?? null,
      teamGroupId === undefined ? null : teamGroupId,
      skills ? JSON.stringify(skills) : null,
      rules ? JSON.stringify(rules) : null,
      constraints ? JSON.stringify(constraints) : null,
      avatarColor ?? null,
    ]
  );

  const agent = result.rows[0];
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  const withTeam = await query<AgentRow>(`${agentSelect} WHERE a.slug = $1`, [req.params.slug]);
  const projectGroups = await getAgentProjectGroups(withTeam.rows[0].id);
  res.json({ agent: mapAgent(withTeam.rows[0], projectGroups) });
});

router.delete("/:slug", authRequired, async (req, res) => {
  const result = await query<AgentRow>(`${agentSelect} WHERE a.slug = $1`, [req.params.slug]);
  const agent = result.rows[0];
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  const protectedSlugs = ["content", "design", "marketing", "development", "sales", "hr", "orchestrator"];
  if (agent.is_template && !agent.parent_agent_id && protectedSlugs.includes(agent.slug)) {
    res.status(403).json({
      error: "Built-in template agents cannot be deleted. Clone it first, or delete a custom/cloned agent.",
    });
    return;
  }

  const cloneCount = await query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM agents WHERE parent_agent_id = $1",
    [agent.id]
  );
  if (parseInt(cloneCount.rows[0]?.count ?? "0", 10) > 0) {
    res.status(403).json({
      error: "This agent has clones. Delete the clones first, or delete a different agent.",
    });
    return;
  }

  await query("DELETE FROM agents WHERE id = $1", [agent.id]);
  res.json({ deleted: true, slug: agent.slug });
});

export default router;
