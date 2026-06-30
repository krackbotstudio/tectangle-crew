import { query } from "../db.js";
import {
  getCatalogTool,
  resolveStackTools,
  type CatalogTool,
  type ProjectToolStatus,
} from "./toolCatalog.js";
import { getWorkspaceIntegrationMap } from "./workspaceIntegrations.js";

export interface ProjectToolRow {
  id: string;
  project_id: string;
  tool_slug: string;
  tool_name: string;
  category: string;
  capabilities: string[];
  status: ProjectToolStatus;
  notes: string | null;
  config: Record<string, unknown>;
  added_by: string | null;
  created_at: string;
  updated_at: string;
}

export function mapProjectTool(
  row: ProjectToolRow,
  workspaceIntegration?: {
    status: string;
    accountLabel: string | null;
    connectionType: string;
  } | null
) {
  const catalog = getCatalogTool(row.tool_slug);
  let status = row.status;
  if (workspaceIntegration?.status === "connected") {
    status = "connected";
  } else if (
    workspaceIntegration?.status === "configured" &&
    (row.status === "planned" || row.status === "requested")
  ) {
    status = "approved";
  }
  return {
    id: row.id,
    projectId: row.project_id,
    toolSlug: row.tool_slug,
    toolName: row.tool_name,
    category: row.category,
    capabilities: row.capabilities,
    status,
    projectStatus: row.status,
    notes: row.notes,
    config: row.config,
    description: catalog?.description ?? null,
    connectVia: catalog?.connectVia ?? null,
    workspaceStatus: workspaceIntegration?.status ?? "not_configured",
    accountLabel: workspaceIntegration?.accountLabel ?? null,
    connectionType: workspaceIntegration?.connectionType ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listProjectTools(projectId: string) {
  const integrationMap = await getWorkspaceIntegrationMap();
  const result = await query<ProjectToolRow>(
    `SELECT * FROM project_tools WHERE project_id = $1 ORDER BY tool_name ASC`,
    [projectId]
  );
  return result.rows.map((row) => mapProjectTool(row, integrationMap.get(row.tool_slug)));
}

export async function addProjectTool(
  projectId: string,
  tool: CatalogTool,
  options?: { status?: ProjectToolStatus; notes?: string; addedBy?: string }
) {
  const result = await query<ProjectToolRow>(
    `INSERT INTO project_tools
       (project_id, tool_slug, tool_name, category, capabilities, status, notes, added_by)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
     ON CONFLICT (project_id, tool_slug) DO UPDATE SET
       tool_name = EXCLUDED.tool_name,
       category = EXCLUDED.category,
       capabilities = EXCLUDED.capabilities,
       updated_at = NOW()
     RETURNING *`,
    [
      projectId,
      tool.slug,
      tool.name,
      tool.category,
      JSON.stringify(tool.capabilities),
      options?.status ?? "planned",
      options?.notes ?? null,
      options?.addedBy ?? null,
    ]
  );
  const integrationMap = await getWorkspaceIntegrationMap();
  return mapProjectTool(result.rows[0], integrationMap.get(tool.slug));
}

export async function applyToolStack(
  projectId: string,
  stackId: string,
  addedBy?: string
) {
  const tools = resolveStackTools(stackId);
  if (tools.length === 0) {
    throw new Error("Unknown tool stack");
  }
  const added = [];
  for (const tool of tools) {
    added.push(await addProjectTool(projectId, tool, { status: "planned", addedBy }));
  }
  return added;
}

export async function updateProjectTool(
  projectId: string,
  toolId: string,
  patch: { status?: ProjectToolStatus; notes?: string | null; config?: Record<string, unknown> }
) {
  const fields: string[] = [];
  const params: unknown[] = [projectId, toolId];

  if (patch.status !== undefined) {
    params.push(patch.status);
    fields.push(`status = $${params.length}`);
  }
  if (patch.notes !== undefined) {
    params.push(patch.notes);
    fields.push(`notes = $${params.length}`);
  }
  if (patch.config !== undefined) {
    params.push(JSON.stringify(patch.config));
    fields.push(`config = $${params.length}::jsonb`);
  }

  if (fields.length === 0) {
    const integrationMap = await getWorkspaceIntegrationMap();
    const existing = await query<ProjectToolRow>(
      `SELECT * FROM project_tools WHERE id = $2 AND project_id = $1`,
      [projectId, toolId]
    );
    return existing.rows[0]
      ? mapProjectTool(existing.rows[0], integrationMap.get(existing.rows[0].tool_slug))
      : null;
  }

  fields.push("updated_at = NOW()");
  const result = await query<ProjectToolRow>(
    `UPDATE project_tools SET ${fields.join(", ")} WHERE id = $2 AND project_id = $1 RETURNING *`,
    params
  );
  const row = result.rows[0];
  if (!row) return null;
  const integrationMap = await getWorkspaceIntegrationMap();
  return mapProjectTool(row, integrationMap.get(row.tool_slug));
}

export async function removeProjectTool(projectId: string, toolId: string) {
  const result = await query<{ id: string }>(
    `DELETE FROM project_tools WHERE id = $2 AND project_id = $1 RETURNING id`,
    [projectId, toolId]
  );
  return !!result.rows[0];
}

/** Tools available to an agent across all project groups they belong to. */
export async function listEffectiveToolsForAgent(agentId: string) {
  const integrationMap = await getWorkspaceIntegrationMap();
  const result = await query<ProjectToolRow>(
    `SELECT DISTINCT ON (pt.tool_slug) pt.*
     FROM project_tools pt
     JOIN project_agents pa ON pa.project_id = pt.project_id
     WHERE pa.agent_id = $1 AND pt.status NOT IN ('disabled')
     ORDER BY pt.tool_slug, pt.updated_at DESC`,
    [agentId]
  );
  return result.rows.map((row) => mapProjectTool(row, integrationMap.get(row.tool_slug)));
}

export async function listEffectiveToolsForAgentOnProject(agentId: string, projectId: string) {
  const membership = await query<{ id: string }>(
    `SELECT id FROM project_agents WHERE agent_id = $1 AND project_id = $2`,
    [agentId, projectId]
  );
  if (!membership.rows[0]) return [];
  return listProjectTools(projectId);
}
