import { Router } from "express";
import { query } from "../db.js";
import { authRequired } from "../middleware/auth.js";
import {
  duplicateActivity,
  duplicateTask,
  getLinkedProjectIds,
  getProjectActivityIds,
  linkActivityToProject,
  syncActivityProjectLink,
  unlinkActivityFromProject,
} from "../services/workLinks.js";
import {
  createProjectGroupForWorkProject,
  deleteProjectGroupForWorkProject,
  ensureWorkProjectGroupsLinked,
  syncAgentToProjectGroup,
  syncProjectGroupFromWorkProject,
} from "../services/workProjectGroups.js";

const router = Router();

type ScheduleType = "one_time" | "scheduled" | "recurring";
type ItemStatus = "todo" | "in_progress" | "done" | "cancelled" | "scheduled";
type Priority = "low" | "medium" | "high";

interface ScheduleInput {
  scheduleType?: ScheduleType;
  scheduledAt?: string | null;
  recurrenceRule?: string | null;
  recurrenceEndAt?: string | null;
}

function deriveScheduleFields(input: ScheduleInput): {
  status: ItemStatus;
  scheduledAt: string | null;
  recurrenceRule: string | null;
  recurrenceEndAt: string | null;
  nextRunAt: string | null;
} {
  const scheduleType = input.scheduleType ?? "one_time";
  const scheduledAt = input.scheduledAt ?? null;
  const recurrenceRule = input.recurrenceRule ?? null;
  const recurrenceEndAt = input.recurrenceEndAt ?? null;

  if (scheduleType === "scheduled" && scheduledAt) {
    return {
      status: "scheduled",
      scheduledAt,
      recurrenceRule: null,
      recurrenceEndAt: null,
      nextRunAt: scheduledAt,
    };
  }

  if (scheduleType === "recurring" && recurrenceRule) {
    const nextRunAt = scheduledAt ?? new Date().toISOString();
    return {
      status: "scheduled",
      scheduledAt,
      recurrenceRule,
      recurrenceEndAt,
      nextRunAt,
    };
  }

  return {
    status: "todo",
    scheduledAt: scheduleType === "one_time" ? scheduledAt : null,
    recurrenceRule: null,
    recurrenceEndAt: null,
    nextRunAt: null,
  };
}

function mapAgentFields(row: {
  agent_id: string | null;
  agent_slug: string | null;
  agent_name: string | null;
  agent_color: string | null;
}) {
  return {
    agentId: row.agent_id,
    agentSlug: row.agent_slug,
    agentName: row.agent_name,
    agentColor: row.agent_color,
  };
}

function mapActivity(row: Record<string, unknown>, linkedProjectIds: string[] = []) {
  return {
    id: row.id as string,
    workProjectId: row.work_project_id as string | null,
    linkedProjectIds,
    sourceActivityId: (row.source_activity_id as string | null) ?? null,
    title: row.title as string,
    description: row.description as string | null,
    ...mapAgentFields(row as never),
    status: row.status as ItemStatus,
    scheduleType: row.schedule_type as ScheduleType,
    scheduledAt: row.scheduled_at as string | null,
    recurrenceRule: row.recurrence_rule as string | null,
    recurrenceEndAt: row.recurrence_end_at as string | null,
    nextRunAt: row.next_run_at as string | null,
    priority: row.priority as Priority,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapWorkTask(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    workProjectId: row.work_project_id as string | null,
    activityId: row.activity_id as string | null,
    sourceTaskId: (row.source_task_id as string | null) ?? null,
    title: row.title as string,
    description: row.description as string | null,
    ...mapAgentFields(row as never),
    status: row.status as ItemStatus,
    scheduleType: row.schedule_type as ScheduleType,
    scheduledAt: row.scheduled_at as string | null,
    recurrenceRule: row.recurrence_rule as string | null,
    recurrenceEndAt: row.recurrence_end_at as string | null,
    nextRunAt: row.next_run_at as string | null,
    priority: row.priority as Priority,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

const activitySelect = `
  SELECT act.*,
    a.slug AS agent_slug, a.name AS agent_name, a.avatar_color AS agent_color
  FROM activities act
  LEFT JOIN agents a ON a.id = act.agent_id
`;

const taskSelect = `
  SELECT wt.*,
    a.slug AS agent_slug, a.name AS agent_name, a.avatar_color AS agent_color
  FROM work_tasks wt
  LEFT JOIN agents a ON a.id = wt.agent_id
`;

router.get("/hub", authRequired, async (_req, res) => {
  await ensureWorkProjectGroupsLinked();

  const projectsResult = await query(
    `SELECT wp.*,
      (
        SELECT COUNT(DISTINCT act.id)::int
        FROM activities act
        LEFT JOIN work_project_activities wpa ON wpa.activity_id = act.id AND wpa.work_project_id = wp.id
        WHERE act.work_project_id = wp.id OR wpa.work_project_id = wp.id
      ) AS activity_count,
      (
        SELECT COUNT(*)::int FROM work_tasks wt
        WHERE wt.activity_id IN (
          SELECT act.id FROM activities act
          LEFT JOIN work_project_activities wpa ON wpa.activity_id = act.id AND wpa.work_project_id = wp.id
          WHERE act.work_project_id = wp.id OR wpa.work_project_id = wp.id
        )
      ) AS task_count
     FROM work_projects wp
     ORDER BY wp.updated_at DESC`
  );

  const activitiesResult = await query(`${activitySelect} ORDER BY act.updated_at DESC`);
  const tasksResult = await query(`${taskSelect} ORDER BY wt.updated_at DESC`);

  const linkedProjectsByActivity = new Map<string, string[]>();
  for (const row of activitiesResult.rows) {
    const ids = await getLinkedProjectIds(row.id as string);
    linkedProjectsByActivity.set(row.id as string, ids);
  }

  const activities = activitiesResult.rows.map((row) =>
    mapActivity(row, linkedProjectsByActivity.get(row.id as string) ?? [])
  );
  const tasks = tasksResult.rows.map(mapWorkTask);

  const tasksByActivity = new Map<string, ReturnType<typeof mapWorkTask>[]>();
  for (const task of tasks) {
    if (task.activityId) {
      const list = tasksByActivity.get(task.activityId) ?? [];
      list.push(task);
      tasksByActivity.set(task.activityId, list);
    }
  }

  const projectTitles = new Map(
    projectsResult.rows.map((row) => [row.id as string, row.title as string])
  );

  const projects = await Promise.all(
    projectsResult.rows.map(async (row) => {
      const activityIds = await getProjectActivityIds(row.id as string);
      const projectActivities = activityIds
        .map((id) => activities.find((a) => a.id === id))
        .filter(Boolean)
        .map((a) => ({
          ...a!,
          projectTitle: row.title as string,
          tasks: tasksByActivity.get(a!.id) ?? [],
        }));

      return {
        id: row.id as string,
        projectGroupId: row.project_group_id as string | null,
        title: row.title as string,
        description: row.description as string | null,
        status: row.status as string,
        startDate: row.start_date as string | null,
        dueDate: row.due_date as string | null,
        activityCount: row.activity_count as number,
        taskCount: row.task_count as number,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
        activities: projectActivities,
      };
    })
  );

  const standaloneActivities = activities
    .filter((a) => !a.workProjectId && a.linkedProjectIds.length === 0)
    .map((a) => ({
      ...a,
      tasks: tasksByActivity.get(a.id) ?? [],
    }));

  const projectActivities = projects.flatMap((p) => p.activities);

  res.json({
    projects,
    projectActivities,
    standaloneActivities,
    standaloneTasks: tasks.filter((t) => !t.activityId),
    allActivities: activities.map((a) => ({
      ...a,
      projectTitle: a.workProjectId ? projectTitles.get(a.workProjectId) : undefined,
      tasks: tasksByActivity.get(a.id) ?? [],
    })),
    allTasks: tasks,
  });
});

router.post("/projects", authRequired, async (req, res) => {
  const { title, description, status, startDate, dueDate } = req.body as {
    title?: string;
    description?: string;
    status?: string;
    startDate?: string | null;
    dueDate?: string | null;
  };

  if (!title?.trim()) {
    res.status(400).json({ error: "title is required" });
    return;
  }

  const inserted = await query(
    `INSERT INTO work_projects (title, description, status, start_date, due_date, created_by)
     VALUES ($1, $2, COALESCE($3, 'active'), $4, $5, $6)
     RETURNING *`,
    [
      title.trim(),
      description?.trim() || null,
      status ?? "active",
      startDate || null,
      dueDate || null,
      req.user!.id,
    ]
  );

  const row = inserted.rows[0];
  const projectGroupId = await createProjectGroupForWorkProject({
    id: row.id as string,
    title: row.title as string,
    description: row.description as string | null,
    status: row.status as string,
    created_by: row.created_by as string | null,
  });

  res.status(201).json({
    project: {
      id: row.id,
      projectGroupId,
      title: row.title,
      description: row.description,
      status: row.status,
      startDate: row.start_date,
      dueDate: row.due_date,
      activityCount: 0,
      taskCount: 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      activities: [],
      tasks: [],
    },
  });
});

router.patch("/projects/:id", authRequired, async (req, res) => {
  const { title, description, status, startDate, dueDate } = req.body as {
    title?: string;
    description?: string;
    status?: string;
    startDate?: string | null;
    dueDate?: string | null;
  };

  const updated = await query(
    `UPDATE work_projects SET
      title = COALESCE($2, title),
      description = COALESCE($3, description),
      status = COALESCE($4, status),
      start_date = COALESCE($5, start_date),
      due_date = COALESCE($6, due_date),
      updated_at = NOW()
     WHERE id = $1
     RETURNING id`,
    [req.params.id, title?.trim(), description?.trim(), status, startDate, dueDate]
  );

  if (!updated.rows[0]) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  await syncProjectGroupFromWorkProject(req.params.id, {
    title: title?.trim(),
    description: description?.trim(),
    status,
  });

  res.json({ updated: true });
});

router.delete("/projects/:id", authRequired, async (req, res) => {
  const existing = await query<{ project_group_id: string | null }>(
    "SELECT project_group_id FROM work_projects WHERE id = $1",
    [req.params.id]
  );
  const projectGroupId = existing.rows[0]?.project_group_id ?? null;

  const deleted = await query("DELETE FROM work_projects WHERE id = $1 RETURNING id", [
    req.params.id,
  ]);
  if (!deleted.rows[0]) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  await deleteProjectGroupForWorkProject(projectGroupId);
  res.json({ deleted: true });
});

router.post("/activities", authRequired, async (req, res) => {
  const {
    title,
    description,
    workProjectId,
    agentId,
    scheduleType,
    scheduledAt,
    recurrenceRule,
    recurrenceEndAt,
    priority,
    status,
  } = req.body as {
    title?: string;
    description?: string;
    workProjectId?: string | null;
    agentId?: string | null;
    scheduleType?: ScheduleType;
    scheduledAt?: string | null;
    recurrenceRule?: string | null;
    recurrenceEndAt?: string | null;
    priority?: Priority;
    status?: ItemStatus;
  };

  if (!title?.trim()) {
    res.status(400).json({ error: "title is required" });
    return;
  }

  const schedule = deriveScheduleFields({ scheduleType, scheduledAt, recurrenceRule, recurrenceEndAt });

  const inserted = await query(
    `INSERT INTO activities (
      work_project_id, title, description, agent_id, status, schedule_type,
      scheduled_at, recurrence_rule, recurrence_end_at, next_run_at, priority, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING id`,
    [
      workProjectId || null,
      title.trim(),
      description?.trim() || null,
      agentId || null,
      status ?? schedule.status,
      scheduleType ?? "one_time",
      schedule.scheduledAt,
      schedule.recurrenceRule,
      schedule.recurrenceEndAt,
      schedule.nextRunAt,
      priority ?? "medium",
      req.user!.id,
    ]
  );

  const full = await query(`${activitySelect} WHERE act.id = $1`, [inserted.rows[0].id]);
  const activityId = inserted.rows[0].id as string;
  if (workProjectId) {
    await syncActivityProjectLink(activityId, workProjectId);
  }
  const fullAfter = await query(`${activitySelect} WHERE act.id = $1`, [activityId]);
  const linkedIds = await getLinkedProjectIds(activityId);
  const activity = mapActivity(fullAfter.rows[0], linkedIds);
  await syncAgentToProjectGroup(workProjectId ?? activity.workProjectId, activity.agentId);
  res.status(201).json({ activity });
});

router.patch("/activities/:id", authRequired, async (req, res) => {
  const {
    title,
    description,
    workProjectId,
    agentId,
    scheduleType,
    scheduledAt,
    recurrenceRule,
    recurrenceEndAt,
    priority,
    status,
  } = req.body as {
    title?: string;
    description?: string;
    workProjectId?: string | null;
    agentId?: string | null;
    scheduleType?: ScheduleType;
    scheduledAt?: string | null;
    recurrenceRule?: string | null;
    recurrenceEndAt?: string | null;
    priority?: Priority;
    status?: ItemStatus;
  };

  const schedule =
    scheduleType !== undefined
      ? deriveScheduleFields({
          scheduleType: scheduleType ?? "one_time",
          scheduledAt,
          recurrenceRule,
          recurrenceEndAt,
        })
      : null;

  const sets: string[] = ["updated_at = NOW()"];
  const params: unknown[] = [req.params.id];
  let n = 2;

  if (title !== undefined) {
    sets.push(`title = $${n++}`);
    params.push(title.trim());
  }
  if (description !== undefined) {
    sets.push(`description = $${n++}`);
    params.push(description?.trim() || null);
  }
  if (workProjectId !== undefined) {
    sets.push(`work_project_id = $${n++}`);
    params.push(workProjectId || null);
  }
  if (agentId !== undefined) {
    sets.push(`agent_id = $${n++}`);
    params.push(agentId || null);
  }
  if (status !== undefined) {
    sets.push(`status = $${n++}`);
    params.push(status);
  } else if (schedule) {
    sets.push(`status = $${n++}`);
    params.push(schedule.status);
  }
  if (schedule) {
    sets.push(`schedule_type = $${n++}`);
    params.push(scheduleType ?? "one_time");
    sets.push(`scheduled_at = $${n++}`);
    params.push(schedule.scheduledAt);
    sets.push(`recurrence_rule = $${n++}`);
    params.push(schedule.recurrenceRule);
    sets.push(`recurrence_end_at = $${n++}`);
    params.push(schedule.recurrenceEndAt);
    sets.push(`next_run_at = $${n++}`);
    params.push(schedule.nextRunAt);
  }
  if (priority !== undefined) {
    sets.push(`priority = $${n++}`);
    params.push(priority);
  }

  const updated = await query(
    `UPDATE activities SET ${sets.join(", ")} WHERE id = $1 RETURNING id`,
    params
  );

  if (!updated.rows[0]) {
    res.status(404).json({ error: "Activity not found" });
    return;
  }

  if (workProjectId) {
    await syncActivityProjectLink(req.params.id, workProjectId);
  } else if (workProjectId === null) {
    const current = await query<{ work_project_id: string | null }>(
      "SELECT work_project_id FROM activities WHERE id = $1",
      [req.params.id]
    );
    if (current.rows[0]?.work_project_id) {
      await unlinkActivityFromProject(current.rows[0].work_project_id, req.params.id);
    }
  }

  if (workProjectId !== undefined || agentId !== undefined) {
    const full = await query<{ work_project_id: string | null; agent_id: string | null }>(
      "SELECT work_project_id, agent_id FROM activities WHERE id = $1",
      [req.params.id]
    );
    const row = full.rows[0];
    if (row) {
      await syncAgentToProjectGroup(row.work_project_id, row.agent_id);
    }
  }

  res.json({ updated: true });
});

router.delete("/activities/:id", authRequired, async (req, res) => {
  const deleted = await query("DELETE FROM activities WHERE id = $1 RETURNING id", [req.params.id]);
  if (!deleted.rows[0]) {
    res.status(404).json({ error: "Activity not found" });
    return;
  }
  res.json({ deleted: true });
});

router.post("/tasks", authRequired, async (req, res) => {
  const {
    title,
    description,
    workProjectId,
    activityId,
    agentId,
    scheduleType,
    scheduledAt,
    recurrenceRule,
    recurrenceEndAt,
    priority,
    status,
  } = req.body as {
    title?: string;
    description?: string;
    workProjectId?: string | null;
    activityId?: string | null;
    agentId?: string | null;
    scheduleType?: ScheduleType;
    scheduledAt?: string | null;
    recurrenceRule?: string | null;
    recurrenceEndAt?: string | null;
    priority?: Priority;
    status?: ItemStatus;
  };

  if (!title?.trim()) {
    res.status(400).json({ error: "title is required" });
    return;
  }

  let resolvedActivityId: string | null = activityId ?? null;

  if (activityId) {
    const actResult = await query<{ id: string }>("SELECT id FROM activities WHERE id = $1", [
      activityId,
    ]);
    if (!actResult.rows[0]) {
      res.status(400).json({ error: "Activity not found" });
      return;
    }
  } else if (workProjectId) {
    res.status(400).json({ error: "Pick an activity to connect this task to" });
    return;
  }

  const schedule = deriveScheduleFields({ scheduleType, scheduledAt, recurrenceRule, recurrenceEndAt });

  const inserted = await query(
    `INSERT INTO work_tasks (
      work_project_id, activity_id, title, description, agent_id, status, schedule_type,
      scheduled_at, recurrence_rule, recurrence_end_at, next_run_at, priority, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING id`,
    [
      workProjectId ?? null,
      resolvedActivityId,
      title.trim(),
      description?.trim() || null,
      agentId || null,
      status ?? schedule.status,
      scheduleType ?? "one_time",
      schedule.scheduledAt,
      schedule.recurrenceRule,
      schedule.recurrenceEndAt,
      schedule.nextRunAt,
      priority ?? "medium",
      req.user!.id,
    ]
  );

  const full = await query(`${taskSelect} WHERE wt.id = $1`, [inserted.rows[0].id]);
  res.status(201).json({ task: mapWorkTask(full.rows[0]) });
});

router.patch("/tasks/:id", authRequired, async (req, res) => {
  let {
    title,
    description,
    workProjectId,
    activityId,
    agentId,
    scheduleType,
    scheduledAt,
    recurrenceRule,
    recurrenceEndAt,
    priority,
    status,
  } = req.body as {
    title?: string;
    description?: string;
    workProjectId?: string | null;
    activityId?: string | null;
    agentId?: string | null;
    scheduleType?: ScheduleType;
    scheduledAt?: string | null;
    recurrenceRule?: string | null;
    recurrenceEndAt?: string | null;
    priority?: Priority;
    status?: ItemStatus;
  };

  if (workProjectId && activityId === undefined) {
    res.status(400).json({ error: "Tasks linked to a project need an activity — pick any activity" });
    return;
  }

  if (activityId) {
    const actResult = await query<{ id: string }>("SELECT id FROM activities WHERE id = $1", [
      activityId,
    ]);
    if (!actResult.rows[0]) {
      res.status(400).json({ error: "Activity not found" });
      return;
    }
  }

  const schedule =
    scheduleType !== undefined
      ? deriveScheduleFields({
          scheduleType: scheduleType ?? "one_time",
          scheduledAt,
          recurrenceRule,
          recurrenceEndAt,
        })
      : null;

  const sets: string[] = ["updated_at = NOW()"];
  const params: unknown[] = [req.params.id];
  let n = 2;

  if (title !== undefined) {
    sets.push(`title = $${n++}`);
    params.push(title.trim());
  }
  if (description !== undefined) {
    sets.push(`description = $${n++}`);
    params.push(description?.trim() || null);
  }
  if (workProjectId !== undefined) {
    sets.push(`work_project_id = $${n++}`);
    params.push(workProjectId || null);
  }
  if (activityId !== undefined) {
    sets.push(`activity_id = $${n++}`);
    params.push(activityId || null);
  }
  if (agentId !== undefined) {
    sets.push(`agent_id = $${n++}`);
    params.push(agentId || null);
  }
  if (status !== undefined) {
    sets.push(`status = $${n++}`);
    params.push(status);
  } else if (schedule) {
    sets.push(`status = $${n++}`);
    params.push(schedule.status);
  }
  if (schedule) {
    sets.push(`schedule_type = $${n++}`);
    params.push(scheduleType ?? "one_time");
    sets.push(`scheduled_at = $${n++}`);
    params.push(schedule.scheduledAt);
    sets.push(`recurrence_rule = $${n++}`);
    params.push(schedule.recurrenceRule);
    sets.push(`recurrence_end_at = $${n++}`);
    params.push(schedule.recurrenceEndAt);
    sets.push(`next_run_at = $${n++}`);
    params.push(schedule.nextRunAt);
  }
  if (priority !== undefined) {
    sets.push(`priority = $${n++}`);
    params.push(priority);
  }

  const updated = await query(
    `UPDATE work_tasks SET ${sets.join(", ")} WHERE id = $1 RETURNING id`,
    params
  );

  if (!updated.rows[0]) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  res.json({ updated: true });
});

router.delete("/tasks/:id", authRequired, async (req, res) => {
  const deleted = await query("DELETE FROM work_tasks WHERE id = $1 RETURNING id", [req.params.id]);
  if (!deleted.rows[0]) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.json({ deleted: true });
});

router.post("/activities/:id/link", authRequired, async (req, res) => {
  const { workProjectId } = req.body as { workProjectId?: string };
  if (!workProjectId) {
    res.status(400).json({ error: "workProjectId is required" });
    return;
  }

  const exists = await query("SELECT id FROM activities WHERE id = $1", [req.params.id]);
  if (!exists.rows[0]) {
    res.status(404).json({ error: "Activity not found" });
    return;
  }

  await linkActivityToProject(workProjectId, req.params.id);
  res.json({ linked: true });
});

router.post("/activities/:id/unlink", authRequired, async (req, res) => {
  const { workProjectId } = req.body as { workProjectId?: string };
  if (!workProjectId) {
    res.status(400).json({ error: "workProjectId is required" });
    return;
  }

  await unlinkActivityFromProject(workProjectId, req.params.id);
  res.json({ unlinked: true });
});

router.post("/activities/:id/duplicate", authRequired, async (req, res) => {
  const { workProjectId, copyTasks } = req.body as {
    workProjectId?: string | null;
    copyTasks?: boolean;
  };

  try {
    const newId = await duplicateActivity(req.params.id, {
      workProjectId: workProjectId ?? null,
      copyTasks: copyTasks ?? true,
      createdBy: req.user!.id,
    });
    const full = await query(`${activitySelect} WHERE act.id = $1`, [newId]);
    const linkedIds = await getLinkedProjectIds(newId);
    res.status(201).json({ activity: mapActivity(full.rows[0], linkedIds) });
  } catch (err) {
    res.status(404).json({ error: err instanceof Error ? err.message : "Duplicate failed" });
  }
});

router.post("/tasks/:id/duplicate", authRequired, async (req, res) => {
  const { activityId, workProjectId } = req.body as {
    activityId?: string | null;
    workProjectId?: string | null;
  };

  try {
    const newId = await duplicateTask(req.params.id, {
      activityId: activityId ?? null,
      workProjectId: workProjectId ?? null,
      createdBy: req.user!.id,
    });
    const full = await query(`${taskSelect} WHERE wt.id = $1`, [newId]);
    res.status(201).json({ task: mapWorkTask(full.rows[0]) });
  } catch (err) {
    res.status(404).json({ error: err instanceof Error ? err.message : "Duplicate failed" });
  }
});

export default router;
