import { query } from "../db.js";

export async function linkActivityToProject(
  workProjectId: string,
  activityId: string
): Promise<void> {
  await query(
    `INSERT INTO work_project_activities (work_project_id, activity_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [workProjectId, activityId]
  );
}

export async function unlinkActivityFromProject(
  workProjectId: string,
  activityId: string
): Promise<void> {
  await query(
    `DELETE FROM work_project_activities
     WHERE work_project_id = $1 AND activity_id = $2`,
    [workProjectId, activityId]
  );

  await query(
    `UPDATE activities SET work_project_id = NULL, updated_at = NOW()
     WHERE id = $1 AND work_project_id = $2`,
    [activityId, workProjectId]
  );
}

export async function getLinkedProjectIds(activityId: string): Promise<string[]> {
  const result = await query<{ work_project_id: string }>(
    `SELECT work_project_id FROM work_project_activities WHERE activity_id = $1
     UNION
     SELECT work_project_id FROM activities WHERE id = $1 AND work_project_id IS NOT NULL`,
    [activityId]
  );
  return result.rows.map((r) => r.work_project_id);
}

export async function getProjectActivityIds(workProjectId: string): Promise<string[]> {
  const result = await query<{ activity_id: string }>(
    `SELECT activity_id FROM work_project_activities WHERE work_project_id = $1
     UNION
     SELECT id AS activity_id FROM activities WHERE work_project_id = $1`,
    [workProjectId]
  );
  return [...new Set(result.rows.map((r) => r.activity_id))];
}

export async function syncActivityProjectLink(
  activityId: string,
  workProjectId: string | null
): Promise<void> {
  if (!workProjectId) return;
  await linkActivityToProject(workProjectId, activityId);
  await query(
    `UPDATE activities SET work_project_id = COALESCE(work_project_id, $2), updated_at = NOW()
     WHERE id = $1`,
    [activityId, workProjectId]
  );
}

interface ActivityRow {
  id: string;
  work_project_id: string | null;
  title: string;
  description: string | null;
  agent_id: string | null;
  status: string;
  schedule_type: string;
  scheduled_at: string | null;
  recurrence_rule: string | null;
  recurrence_end_at: string | null;
  next_run_at: string | null;
  priority: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  source_activity_id: string | null;
}

export async function duplicateActivity(
  sourceId: string,
  options: {
    workProjectId?: string | null;
    copyTasks?: boolean;
    createdBy: string;
  }
): Promise<string> {
  const source = await query<ActivityRow>("SELECT * FROM activities WHERE id = $1", [sourceId]);
  const row = source.rows[0];
  if (!row) throw new Error("Activity not found");

  const inserted = await query<{ id: string }>(
    `INSERT INTO activities (
      work_project_id, title, description, agent_id, status, schedule_type,
      scheduled_at, recurrence_rule, recurrence_end_at, next_run_at, priority,
      created_by, source_activity_id
    ) VALUES ($1, $2, $3, $4, 'todo', $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING id`,
    [
      options.workProjectId ?? row.work_project_id,
      `${row.title} (copy)`,
      row.description,
      row.agent_id,
      row.schedule_type,
      row.scheduled_at,
      row.recurrence_rule,
      row.recurrence_end_at,
      row.next_run_at,
      row.priority,
      options.createdBy,
      sourceId,
    ]
  );

  const newId = inserted.rows[0].id;
  if (options.workProjectId) {
    await linkActivityToProject(options.workProjectId, newId);
  } else if (row.work_project_id) {
    await linkActivityToProject(row.work_project_id, newId);
  }

  if (options.copyTasks) {
    const tasks = await query<{ id: string }>(
      "SELECT id FROM work_tasks WHERE activity_id = $1",
      [sourceId]
    );
    for (const task of tasks.rows) {
      await duplicateTask(task.id, {
        activityId: newId,
        workProjectId: options.workProjectId ?? row.work_project_id,
        createdBy: options.createdBy,
      });
    }
  }

  return newId;
}

export async function duplicateTask(
  sourceId: string,
  options: {
    activityId?: string | null;
    workProjectId?: string | null;
    createdBy: string;
  }
): Promise<string> {
  const source = await query<{
    id: string;
    work_project_id: string | null;
    activity_id: string | null;
    title: string;
    description: string | null;
    agent_id: string | null;
    schedule_type: string;
    scheduled_at: string | null;
    recurrence_rule: string | null;
    recurrence_end_at: string | null;
    next_run_at: string | null;
    priority: string;
  }>("SELECT * FROM work_tasks WHERE id = $1", [sourceId]);

  const row = source.rows[0];
  if (!row) throw new Error("Task not found");

  const inserted = await query<{ id: string }>(
    `INSERT INTO work_tasks (
      work_project_id, activity_id, title, description, agent_id, status, schedule_type,
      scheduled_at, recurrence_rule, recurrence_end_at, next_run_at, priority,
      created_by, source_task_id
    ) VALUES ($1, $2, $3, $4, $5, 'todo', $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING id`,
    [
      options.workProjectId ?? row.work_project_id,
      options.activityId ?? row.activity_id,
      `${row.title} (copy)`,
      row.description,
      row.agent_id,
      row.schedule_type,
      row.scheduled_at,
      row.recurrence_rule,
      row.recurrence_end_at,
      row.next_run_at,
      row.priority,
      options.createdBy,
      sourceId,
    ]
  );

  return inserted.rows[0].id;
}
