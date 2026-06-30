import { query } from "../db.js";

interface SourceAgentRow {
  id: string;
  slug: string;
  name: string;
  team: string;
  webhook_url: string | null;
  chat_webhook_path: string | null;
  workflow_id: string | null;
  system_prompt: string | null;
  connected_apps: string[];
  team_group_id: string | null;
  description: string | null;
  skills: string[];
  rules: string[];
  constraints: string[];
  avatar_color: string | null;
  is_template: boolean;
  parent_agent_id: string | null;
  chat_mode: "direct" | "n8n";
  llm_provider: string | null;
  llm_model: string | null;
  llm_temperature: number;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Clone a template (or team agent) into a project-scoped working instance. */
export async function instantiateAgentForProject(input: {
  sourceAgentId: string;
  projectId: string;
  projectTitle?: string;
  skills?: string[];
  rules?: string[];
  constraints?: string[];
}): Promise<{ agentId: string; slug: string; name: string }> {
  const sourceResult = await query<SourceAgentRow>(
    "SELECT * FROM agents WHERE id = $1",
    [input.sourceAgentId]
  );
  const src = sourceResult.rows[0];
  if (!src) {
    throw new Error("Source agent not found");
  }

  // Re-use an existing project instance when the same template is already linked to this group.
  if (!src.is_template && src.parent_agent_id) {
    const existing = await query<{ agent_id: string; slug: string; name: string }>(
      `SELECT pa.agent_id, a.slug, a.name
       FROM project_agents pa
       JOIN agents a ON a.id = pa.agent_id
       WHERE pa.project_id = $1 AND pa.agent_id = $2`,
      [input.projectId, src.id]
    );
    if (existing.rows[0]) {
      return {
        agentId: existing.rows[0].agent_id,
        slug: existing.rows[0].slug,
        name: existing.rows[0].name,
      };
    }
  }

  const templateRootId = src.is_template ? src.id : src.parent_agent_id ?? src.id;
  const duplicate = await query<{ agent_id: string; slug: string; name: string }>(
    `SELECT pa.agent_id, a.slug, a.name
     FROM project_agents pa
     JOIN agents a ON a.id = pa.agent_id
     WHERE pa.project_id = $1
       AND (a.parent_agent_id = $2 OR a.id = $2)
     LIMIT 1`,
    [input.projectId, templateRootId]
  );
  if (duplicate.rows[0]) {
    return {
      agentId: duplicate.rows[0].agent_id,
      slug: duplicate.rows[0].slug,
      name: duplicate.rows[0].name,
    };
  }

  const projectShort = input.projectId.replace(/-/g, "").slice(0, 8);
  const slug = `${slugify(src.slug)}-pg-${projectShort}-${Date.now().toString(36)}`;
  const instanceName = src.name;

  const skills = input.skills ?? src.skills ?? [];
  const rules = input.rules ?? src.rules ?? [];
  const constraints = input.constraints ?? src.constraints ?? [];

  const inserted = await query<{ id: string }>(
    `INSERT INTO agents (
      slug, name, team, webhook_url, chat_webhook_path, workflow_id, system_prompt,
      knowledge_collection_id, connected_apps, is_active, team_group_id, parent_agent_id,
      description, skills, rules, constraints, avatar_color, is_template,
      chat_mode, llm_provider, llm_model, llm_temperature
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,$10,$11,$12,$13,$14,$15,$16,false,$17,$18,$19,$20)
    RETURNING id`,
    [
      slug,
      instanceName,
      src.team,
      src.webhook_url,
      src.chat_webhook_path,
      src.workflow_id,
      src.system_prompt,
      `${slug}-kb`,
      JSON.stringify(src.connected_apps ?? []),
      src.team_group_id,
      templateRootId,
      src.description,
      JSON.stringify(skills),
      JSON.stringify(rules),
      JSON.stringify(constraints),
      src.avatar_color,
      src.chat_mode ?? "direct",
      src.llm_provider,
      src.llm_model,
      src.llm_temperature ?? 0.7,
    ]
  );

  return {
    agentId: inserted.rows[0].id,
    slug,
    name: instanceName,
  };
}

async function reassignProjectAgentReferences(
  projectId: string,
  fromAgentId: string,
  toAgentId: string
): Promise<void> {
  await query(
    "UPDATE chat_messages SET agent_id = $3 WHERE project_id = $1 AND agent_id = $2",
    [projectId, fromAgentId, toAgentId]
  );
  await query(
    "UPDATE tasks SET agent_id = $3 WHERE parent_project_id = $1 AND agent_id = $2",
    [projectId, fromAgentId, toAgentId]
  );
}

/** Replace template rows in project_agents with dedicated project instances. */
export async function repairTemplateProjectLinks(): Promise<number> {
  const rows = await query<{
    membership_id: string;
    project_id: string;
    agent_id: string;
    skills: string[];
    rules: string[];
    constraints: string[];
    project_title: string;
  }>(
    `SELECT pa.id AS membership_id, pa.project_id, pa.agent_id, pa.skills, pa.rules, pa.constraints,
            p.title AS project_title
     FROM project_agents pa
     JOIN agents a ON a.id = pa.agent_id
     JOIN projects p ON p.id = pa.project_id
     WHERE a.is_template = true`
  );

  let repaired = 0;
  for (const row of rows.rows) {
    const instance = await instantiateAgentForProject({
      sourceAgentId: row.agent_id,
      projectId: row.project_id,
      projectTitle: row.project_title,
      skills: row.skills,
      rules: row.rules,
      constraints: row.constraints,
    });

    if (instance.agentId === row.agent_id) continue;

    await query("UPDATE project_agents SET agent_id = $2 WHERE id = $1", [
      row.membership_id,
      instance.agentId,
    ]);
    await reassignProjectAgentReferences(row.project_id, row.agent_id, instance.agentId);
    repaired += 1;
  }

  return repaired;
}

/** Remove a project instance agent when it is not used in any other group. */
export async function deleteProjectAgentInstance(agentId: string): Promise<void> {
  const agent = await query<{ is_template: boolean; parent_agent_id: string | null }>(
    "SELECT is_template, parent_agent_id FROM agents WHERE id = $1",
    [agentId]
  );
  const row = agent.rows[0];
  if (!row || row.is_template || !row.parent_agent_id) return;

  const other = await query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM project_agents WHERE agent_id = $1",
    [agentId]
  );
  if (parseInt(other.rows[0]?.count ?? "0", 10) > 0) return;

  await query("DELETE FROM agents WHERE id = $1", [agentId]);
}
