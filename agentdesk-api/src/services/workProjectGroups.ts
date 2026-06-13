import { query } from "../db.js";

interface WorkProjectRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  created_by: string | null;
  project_group_id: string | null;
}

function mapWorkStatusToGroupStatus(status: string): string {
  if (status === "archived") return "planning";
  return status;
}

export async function ensureWorkProjectGroupsLinked(): Promise<void> {
  const orphaned = await query<WorkProjectRow>(
    `SELECT id, title, description, status, created_by, project_group_id
     FROM work_projects
     WHERE project_group_id IS NULL`
  );

  for (const row of orphaned.rows) {
    await createProjectGroupForWorkProject(row);
  }
}

export async function createProjectGroupForWorkProject(
  workProject: Pick<WorkProjectRow, "id" | "title" | "description" | "status" | "created_by">
): Promise<string> {
  const inserted = await query<{ id: string }>(
    `INSERT INTO projects (title, goal, description, status, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [
      workProject.title,
      workProject.description,
      workProject.description,
      mapWorkStatusToGroupStatus(workProject.status),
      workProject.created_by,
    ]
  );

  const projectGroupId = inserted.rows[0].id;
  await query("UPDATE work_projects SET project_group_id = $2 WHERE id = $1", [
    workProject.id,
    projectGroupId,
  ]);

  return projectGroupId;
}

export async function syncProjectGroupFromWorkProject(
  workProjectId: string,
  updates: { title?: string; description?: string | null; status?: string }
): Promise<void> {
  const current = await query<{ project_group_id: string | null }>(
    "SELECT project_group_id FROM work_projects WHERE id = $1",
    [workProjectId]
  );
  const projectGroupId = current.rows[0]?.project_group_id;
  if (!projectGroupId) return;

  await query(
    `UPDATE projects SET
      title = COALESCE($2, title),
      goal = COALESCE($3, goal),
      description = COALESCE($3, description),
      status = COALESCE($4, status),
      updated_at = NOW()
     WHERE id = $1`,
    [
      projectGroupId,
      updates.title ?? null,
      updates.description ?? null,
      updates.status ? mapWorkStatusToGroupStatus(updates.status) : null,
    ]
  );
}

export async function deleteProjectGroupForWorkProject(projectGroupId: string | null): Promise<void> {
  if (!projectGroupId) return;
  await query("DELETE FROM projects WHERE id = $1", [projectGroupId]);
}

export async function deleteWorkProjectForGroup(projectGroupId: string): Promise<void> {
  await query("DELETE FROM work_projects WHERE project_group_id = $1", [projectGroupId]);
}

export async function syncAgentToProjectGroup(
  workProjectId: string | null | undefined,
  agentId: string | null | undefined
): Promise<void> {
  if (!workProjectId || !agentId) return;

  const wp = await query<{ project_group_id: string | null }>(
    "SELECT project_group_id FROM work_projects WHERE id = $1",
    [workProjectId]
  );
  const projectGroupId = wp.rows[0]?.project_group_id;
  if (!projectGroupId) return;

  const agent = await query<{ skills: unknown; rules: unknown; constraints: unknown }>(
    "SELECT skills, rules, constraints FROM agents WHERE id = $1",
    [agentId]
  );
  const row = agent.rows[0];
  if (!row) return;

  const skills = typeof row.skills === "string" ? row.skills : JSON.stringify(row.skills ?? []);
  const rules = typeof row.rules === "string" ? row.rules : JSON.stringify(row.rules ?? []);
  const constraints =
    typeof row.constraints === "string" ? row.constraints : JSON.stringify(row.constraints ?? []);

  await query(
    `INSERT INTO project_agents (project_id, agent_id, skills, rules, constraints)
     VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb)
     ON CONFLICT (project_id, agent_id) DO NOTHING`,
    [projectGroupId, agentId, skills, rules, constraints]
  );
}

export async function getWorkProjectIdForGroup(projectGroupId: string): Promise<string | null> {
  const result = await query<{ id: string }>(
    "SELECT id FROM work_projects WHERE project_group_id = $1",
    [projectGroupId]
  );
  return result.rows[0]?.id ?? null;
}
