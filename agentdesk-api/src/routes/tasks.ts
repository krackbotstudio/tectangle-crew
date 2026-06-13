import { Router } from "express";
import { query } from "../db.js";
import { authRequired, webhookAuth } from "../middleware/auth.js";
import { config } from "../config.js";

const router = Router();

export type TaskStatus = "queued" | "running" | "done" | "failed" | "pending_approval";

interface TaskRow {
  id: string;
  agent_id: string;
  agent_slug: string;
  agent_name: string;
  title: string;
  status: TaskStatus;
  current_step: string | null;
  execution_id: string | null;
  output_ref: string | null;
  parent_project_id: string | null;
  error_detail: string | null;
  created_at: string;
  updated_at: string;
  workflow_id: string | null;
}

function mapTask(row: TaskRow) {
  const n8nExecutionUrl =
    row.execution_id && row.workflow_id
      ? `${config.n8nBaseUrl}/workflow/${row.workflow_id}/executions/${row.execution_id}`
      : row.execution_id
        ? `${config.n8nBaseUrl}/executions/${row.execution_id}`
        : null;

  return {
    id: row.id,
    agentId: row.agent_id,
    agentSlug: row.agent_slug,
    agentName: row.agent_name,
    title: row.title,
    status: row.status,
    currentStep: row.current_step,
    executionId: row.execution_id,
    outputRef: row.output_ref,
    parentProjectId: row.parent_project_id,
    errorDetail: row.error_detail,
    n8nExecutionUrl,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

router.get("/agent/:slug", authRequired, async (req, res) => {
  const { status, limit = "50" } = req.query;
  const params: unknown[] = [req.params.slug];
  let sql = `
    SELECT t.*, a.slug AS agent_slug, a.name AS agent_name, a.workflow_id
    FROM tasks t
    JOIN agents a ON a.id = t.agent_id
    WHERE a.slug = $1
  `;

  if (status && typeof status === "string") {
    params.push(status);
    sql += ` AND t.status = $${params.length}`;
  }

  params.push(parseInt(limit as string, 10) || 50);
  sql += ` ORDER BY t.created_at DESC LIMIT $${params.length}`;

  const result = await query<TaskRow>(sql, params);
  res.json({ tasks: result.rows.map(mapTask) });
});

router.get("/recent", authRequired, async (req, res) => {
  const limit = parseInt((req.query.limit as string) || "20", 10);
  const result = await query<TaskRow>(
    `SELECT t.*, a.slug AS agent_slug, a.name AS agent_name, a.workflow_id
     FROM tasks t
     JOIN agents a ON a.id = t.agent_id
     ORDER BY t.created_at DESC
     LIMIT $1`,
    [limit]
  );
  res.json({ tasks: result.rows.map(mapTask) });
});

router.post("/log", webhookAuth, async (req, res) => {
  const {
    taskId,
    agentSlug,
    title,
    status,
    currentStep,
    executionId,
    outputRef,
    parentProjectId,
    errorDetail,
  } = req.body as {
    taskId?: string;
    agentSlug: string;
    title?: string;
    status: TaskStatus;
    currentStep?: string;
    executionId?: string;
    outputRef?: string;
    parentProjectId?: string;
    errorDetail?: string;
  };

  if (!agentSlug || !status) {
    res.status(400).json({ error: "agentSlug and status are required" });
    return;
  }

  const agentResult = await query<{ id: string }>("SELECT id FROM agents WHERE slug = $1", [
    agentSlug,
  ]);
  const agent = agentResult.rows[0];
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  if (taskId) {
    const updated = await query("SELECT id FROM tasks WHERE id = $1", [taskId]);
    if (updated.rows[0]) {
      await query(
        `UPDATE tasks SET
          status = COALESCE($2, status),
          current_step = COALESCE($3, current_step),
          execution_id = COALESCE($4, execution_id),
          output_ref = COALESCE($5, output_ref),
          error_detail = COALESCE($6, error_detail),
          title = COALESCE($7, title),
          updated_at = NOW()
        WHERE id = $1`,
        [
          taskId,
          status,
          currentStep ?? null,
          executionId ?? null,
          outputRef ?? null,
          errorDetail ?? null,
          title ?? null,
        ]
      );

      const withAgent = await query<TaskRow>(
        `SELECT t.*, a.slug AS agent_slug, a.name AS agent_name, a.workflow_id
         FROM tasks t JOIN agents a ON a.id = t.agent_id WHERE t.id = $1`,
        [taskId]
      );
      res.json({ task: mapTask(withAgent.rows[0]) });
      return;
    }
  }

  const inserted = await query<{ id: string }>(
    `INSERT INTO tasks (agent_id, title, status, current_step, execution_id, output_ref, parent_project_id, error_detail)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      agent.id,
      title || `${agentSlug} task`,
      status,
      currentStep ?? null,
      executionId ?? null,
      outputRef ?? null,
      parentProjectId ?? null,
      errorDetail ?? null,
    ]
  );

  const withAgent = await query<TaskRow>(
    `SELECT t.*, a.slug AS agent_slug, a.name AS agent_name, a.workflow_id
     FROM tasks t JOIN agents a ON a.id = t.agent_id WHERE t.id = $1`,
    [inserted.rows[0].id]
  );

  res.status(201).json({ task: mapTask(withAgent.rows[0]) });
});

export default router;
