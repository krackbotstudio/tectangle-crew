import { query } from "../db.js";

export interface ProjectGroupContext {
  projectId: string;
  title: string;
  goal: string | null;
  description: string | null;
  teammates: Array<{ name: string; slug: string; role: string }>;
  agentConfig: {
    skills: string[];
    rules: string[];
    constraints: string[];
  };
}

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  return [];
}

export function mergeProjectAgentConfig(
  agent: { skills: string[]; rules: string[]; constraints: string[] },
  projectOverrides: { skills: unknown; rules: unknown; constraints: unknown } | null
): { skills: string[]; rules: string[]; constraints: string[] } {
  if (!projectOverrides) return agent;
  return {
    skills: parseJsonArray(projectOverrides.skills).length
      ? parseJsonArray(projectOverrides.skills)
      : agent.skills,
    rules: parseJsonArray(projectOverrides.rules).length
      ? parseJsonArray(projectOverrides.rules)
      : agent.rules,
    constraints: parseJsonArray(projectOverrides.constraints).length
      ? parseJsonArray(projectOverrides.constraints)
      : agent.constraints,
  };
}

export async function loadProjectGroupContext(
  projectId: string,
  agentId: string
): Promise<ProjectGroupContext | null> {
  const projectResult = await query<{
    title: string;
    goal: string | null;
    description: string | null;
  }>(`SELECT title, goal, description FROM projects WHERE id = $1`, [projectId]);

  const project = projectResult.rows[0];
  if (!project) return null;

  const membershipResult = await query<{
    skills: unknown;
    rules: unknown;
    constraints: unknown;
    agent_skills: unknown;
    agent_rules: unknown;
    agent_constraints: unknown;
  }>(
    `SELECT pa.skills, pa.rules, pa.constraints,
            a.skills AS agent_skills, a.rules AS agent_rules, a.constraints AS agent_constraints
     FROM project_agents pa
     JOIN agents a ON a.id = pa.agent_id
     WHERE pa.project_id = $1 AND pa.agent_id = $2`,
    [projectId, agentId]
  );

  const membership = membershipResult.rows[0];
  const agentConfig = mergeProjectAgentConfig(
    {
      skills: parseJsonArray(membership?.agent_skills),
      rules: parseJsonArray(membership?.agent_rules),
      constraints: parseJsonArray(membership?.agent_constraints),
    },
    membership
      ? { skills: membership.skills, rules: membership.rules, constraints: membership.constraints }
      : null
  );

  const teammatesResult = await query<{ name: string; slug: string; role: string }>(
    `SELECT a.name, a.slug, pa.role
     FROM project_agents pa
     JOIN agents a ON a.id = pa.agent_id
     WHERE pa.project_id = $1 AND pa.agent_id != $2 AND a.is_active = true
     ORDER BY pa.added_at`,
    [projectId, agentId]
  );

  return {
    projectId,
    title: project.title,
    goal: project.goal,
    description: project.description,
    teammates: teammatesResult.rows,
    agentConfig,
  };
}

export function formatProjectBrief(ctx: ProjectGroupContext): string {
  const lines = [`Project: ${ctx.title}`];
  if (ctx.goal?.trim()) lines.push(`Goal: ${ctx.goal.trim()}`);
  if (ctx.description?.trim()) lines.push(`Description: ${ctx.description.trim()}`);
  if (ctx.teammates.length > 0) {
    lines.push(
      `Other agents in this group: ${ctx.teammates.map((t) => `${t.name} (${t.role})`).join(", ")}`
    );
  }
  return lines.join("\n");
}
