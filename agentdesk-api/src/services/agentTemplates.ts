import { query } from "../db.js";

export async function canUseAgentTemplate(agentId: string, viewerUserId: string): Promise<boolean> {
  const result = await query<{
    is_template: boolean;
    template_visibility: string;
    created_by: string | null;
  }>("SELECT is_template, template_visibility, created_by FROM agents WHERE id = $1", [agentId]);
  const agent = result.rows[0];
  if (!agent) return false;
  if (!agent.is_template) return true;
  if (agent.template_visibility === "public" || !agent.created_by) return true;
  return agent.created_by === viewerUserId;
}

export async function canViewAgentTemplate(
  agent: { is_template: boolean; template_visibility?: string; created_by?: string | null },
  viewerUserId: string
): Promise<boolean> {
  if (!agent.is_template) return true;
  if (agent.template_visibility !== "private") return true;
  if (!agent.created_by) return true;
  return agent.created_by === viewerUserId;
}
