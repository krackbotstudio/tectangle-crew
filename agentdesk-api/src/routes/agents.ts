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
  chat_mode: "direct" | "n8n";
  llm_provider: string | null;
  llm_model: string | null;
  llm_temperature: number;
  team_group_slug?: string | null;
  team_group_name?: string | null;
  team_group_color?: string | null;
  parent_agent_name?: string | null;
  created_by?: string | null;
  template_visibility?: string;
  creator_name?: string | null;
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

function mapAgent(
  row: AgentRow,
  projectGroups?: { id: string; title: string }[],
  viewerUserId?: string
) {
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
    chatMode: row.chat_mode ?? "direct",
    llmProvider: row.llm_provider,
    llmModel: row.llm_model,
    llmTemperature: row.llm_temperature ?? 0.7,
    isClone: !!row.parent_agent_id,
    parentAgentName: row.parent_agent_name ?? null,
    shortId: row.id.slice(0, 8),
    projectGroups: projectGroups ?? [],
    teamGroup: row.team_group_slug
      ? { slug: row.team_group_slug, name: row.team_group_name, color: row.team_group_color }
      : null,
    templateVisibility: (row.template_visibility as "public" | "private") ?? "public",
    createdById: row.created_by ?? null,
    creatorName: row.creator_name ?? null,
    isOwner: viewerUserId ? row.created_by === viewerUserId : false,
  };
}

import { canViewAgentTemplate } from "../services/agentTemplates.js";

const agentSelect = `
  SELECT a.*, tg.slug AS team_group_slug, tg.name AS team_group_name, tg.color AS team_group_color,
         parent.name AS parent_agent_name,
         creator.name AS creator_name
  FROM agents a
  LEFT JOIN team_groups tg ON tg.id = a.team_group_id
  LEFT JOIN agents parent ON parent.id = a.parent_agent_id
  LEFT JOIN users creator ON creator.id = a.created_by
`;

router.get("/", authRequired, async (req, res) => {
  const { teamGroupId, templatesOnly, mineOnly } = req.query;
  const userId = req.user!.id;
  let sql = `${agentSelect} WHERE 1=1`;
  const params: unknown[] = [];

  if (teamGroupId) {
    params.push(teamGroupId);
    sql += ` AND a.team_group_id = $${params.length}`;
  }

  if (templatesOnly === "true") {
    sql += ` AND a.is_template = true AND a.parent_agent_id IS NULL`;
    params.push(userId);
    sql += ` AND (
      a.template_visibility = 'public'
      OR a.created_by IS NULL
      OR a.created_by = $${params.length}
    )`;
    if (mineOnly === "true") {
      sql += ` AND a.created_by = $${params.length}`;
    }
  }

  sql += ` ORDER BY a.is_template DESC, a.team, a.name`;

  const result = await query<AgentRow>(sql, params);
  res.json({
    agents: await Promise.all(
      result.rows.map(async (row) =>
        mapAgent(row, await getAgentProjectGroups(row.id), userId)
      )
    ),
  });
});

router.post("/templates", authRequired, async (req, res) => {
  const userId = req.user!.id;
  const {
    name,
    description,
    teamGroupId,
    team,
    skills,
    rules,
    constraints,
    systemPrompt,
    templateVisibility,
    avatarColor,
    sourceSlug,
  } = req.body as {
    name?: string;
    description?: string;
    teamGroupId?: string;
    team?: string;
    skills?: string[];
    rules?: string[];
    constraints?: string[];
    systemPrompt?: string;
    templateVisibility?: "public" | "private";
    avatarColor?: string;
    sourceSlug?: string;
  };

  if (!name?.trim()) {
    res.status(400).json({ error: "Template name is required" });
    return;
  }

  let baseSkills: string[] = [];
  let baseRules: string[] = [];
  let baseConstraints: string[] = [];
  let baseDescription: string | null = null;
  let baseSystemPrompt: string | null = null;
  let baseTeam = team?.trim() || "custom";
  let baseTeamGroupId: string | null = teamGroupId ?? null;
  let baseAvatarColor = avatarColor ?? "#6366f1";

  if (sourceSlug) {
    const source = await query<AgentRow>(`${agentSelect} WHERE a.slug = $1`, [sourceSlug]);
    const src = source.rows[0];
    if (!src) {
      res.status(404).json({ error: "Source agent not found" });
      return;
    }
    if (!(await canViewAgentTemplate(src, userId))) {
      res.status(403).json({ error: "You cannot copy this private template" });
      return;
    }
    baseSkills = src.skills ?? [];
    baseRules = src.rules ?? [];
    baseConstraints = src.constraints ?? [];
    baseDescription = src.description;
    baseSystemPrompt = src.system_prompt;
    baseTeam = src.team;
    baseTeamGroupId = src.team_group_id;
    baseAvatarColor = src.avatar_color ?? baseAvatarColor;
  }

  const visibility = templateVisibility === "private" ? "private" : "public";
  const baseSlug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const slug = `${baseSlug}-${Date.now().toString(36)}`;

  if (teamGroupId) {
    const teamRow = await query<{ id: string; name: string }>(
      "SELECT id, name FROM team_groups WHERE id = $1",
      [teamGroupId]
    );
    if (teamRow.rows[0]) {
      baseTeam = teamRow.rows[0].name.toLowerCase();
    }
  }

  const inserted = await query<AgentRow>(
    `INSERT INTO agents (
      slug, name, team, system_prompt, knowledge_collection_id, connected_apps,
      is_active, team_group_id, description, skills, rules, constraints,
      avatar_color, is_template, chat_mode, created_by, template_visibility
    ) VALUES ($1,$2,$3,$4,$5,'[]'::jsonb,true,$6,$7,$8,$9,$10,$11,true,'direct',$12,$13)
    RETURNING *`,
    [
      slug,
      name.trim(),
      baseTeam,
      systemPrompt ?? baseSystemPrompt,
      `${slug}-kb`,
      baseTeamGroupId,
      description ?? baseDescription,
      JSON.stringify(skills ?? baseSkills),
      JSON.stringify(rules ?? baseRules),
      JSON.stringify(constraints ?? baseConstraints),
      baseAvatarColor,
      userId,
      visibility,
    ]
  );

  const withTeam = await query<AgentRow>(`${agentSelect} WHERE a.id = $1`, [inserted.rows[0].id]);
  const projectGroups = await getAgentProjectGroups(withTeam.rows[0].id);
  res.status(201).json({ agent: mapAgent(withTeam.rows[0], projectGroups, userId) });
});

router.use("/:slug/board", agentBoardRoutes);

router.get("/:slug", authRequired, async (req, res) => {
  const result = await query<AgentRow>(`${agentSelect} WHERE a.slug = $1`, [req.params.slug]);
  const agent = result.rows[0];
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }
  if (!(await canViewAgentTemplate(agent, req.user!.id))) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }
  const projectGroups = await getAgentProjectGroups(agent.id);
  res.json({ agent: mapAgent(agent, projectGroups, req.user!.id) });
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
  res.status(201).json({ agent: mapAgent(withTeam.rows[0], projectGroups, req.user!.id) });
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
    chatMode,
    llmProvider,
    llmModel,
    llmTemperature,
    templateVisibility,
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
    chatMode?: "direct" | "n8n";
    llmProvider?: string | null;
    llmModel?: string | null;
    llmTemperature?: number;
    templateVisibility?: "public" | "private";
  };

  const existing = await query<AgentRow>(`${agentSelect} WHERE a.slug = $1`, [req.params.slug]);
  const existingAgent = existing.rows[0];
  if (!existingAgent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  if (
    templateVisibility !== undefined &&
    existingAgent.is_template &&
    existingAgent.created_by &&
    existingAgent.created_by !== req.user!.id &&
    req.user?.role !== "admin"
  ) {
    res.status(403).json({ error: "Only the template owner can change visibility" });
    return;
  }

  const isAdmin = req.user?.role === "admin";
  const sensitiveFields =
    webhookUrl !== undefined ||
    chatWebhookPath !== undefined ||
    workflowId !== undefined ||
    isActive !== undefined ||
    chatMode !== undefined ||
    llmProvider !== undefined ||
    llmModel !== undefined ||
    llmTemperature !== undefined;

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
      chat_mode = COALESCE($15, chat_mode),
      llm_provider = COALESCE($16, llm_provider),
      llm_model = COALESCE($17, llm_model),
      llm_temperature = COALESCE($18, llm_temperature),
      template_visibility = COALESCE($19, template_visibility),
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
      chatMode ?? null,
      llmProvider === undefined ? null : llmProvider,
      llmModel === undefined ? null : llmModel,
      llmTemperature ?? null,
      templateVisibility ?? null,
    ]
  );

  const agent = result.rows[0];
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  const withTeam = await query<AgentRow>(`${agentSelect} WHERE a.slug = $1`, [req.params.slug]);
  const projectGroups = await getAgentProjectGroups(withTeam.rows[0].id);
  res.json({ agent: mapAgent(withTeam.rows[0], projectGroups, req.user!.id) });
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
      error: "Built-in template agents cannot be deleted.",
    });
    return;
  }

  if (
    agent.is_template &&
    agent.created_by &&
    agent.created_by !== req.user!.id &&
    req.user?.role !== "admin"
  ) {
    res.status(403).json({ error: "Only the template owner can delete this template" });
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
