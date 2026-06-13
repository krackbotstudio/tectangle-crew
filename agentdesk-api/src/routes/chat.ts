import { Router } from "express";
import { query } from "../db.js";
import { authRequired } from "../middleware/auth.js";
import { config } from "../config.js";
import { retrieveKnowledgeContext } from "../services/knowledgeIndexer.js";

const router = Router();

router.get("/:slug/messages", authRequired, async (req, res) => {
  const agentResult = await query<{ id: string }>("SELECT id FROM agents WHERE slug = $1", [
    req.params.slug,
  ]);
  const agent = agentResult.rows[0];
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  const result = await query<{
    id: string;
    role: "user" | "assistant";
    content: string;
    created_at: string;
  }>(
    `SELECT id, role, content, created_at FROM chat_messages
     WHERE agent_id = $1 AND (user_id = $2 OR user_id IS NULL)
     ORDER BY created_at ASC
     LIMIT 200`,
    [agent.id, req.user!.id]
  );

  res.json({
    messages: result.rows.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.created_at,
    })),
  });
});

router.post("/:slug/send", authRequired, async (req, res) => {
  const { message } = req.body as { message?: string };
  if (!message?.trim()) {
    res.status(400).json({ error: "Message is required" });
    return;
  }

  const agentResult = await query<{
    id: string;
    slug: string;
    name: string;
    webhook_url: string | null;
    chat_webhook_path: string | null;
    system_prompt: string | null;
    is_active: boolean;
  }>("SELECT * FROM agents WHERE slug = $1", [req.params.slug]);

  const agent = agentResult.rows[0];
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  await query(
    "INSERT INTO chat_messages (agent_id, user_id, role, content) VALUES ($1, $2, 'user', $3)",
    [agent.id, req.user!.id, message.trim()]
  );

  const webhookUrl =
    agent.webhook_url ||
    (agent.chat_webhook_path
      ? `${config.n8nBaseUrl}/webhook/${agent.chat_webhook_path}`
      : null);

  if (!webhookUrl || !agent.is_active) {
    const fallback =
      agent.is_active === false
        ? `The ${agent.name} is not active yet. An admin needs to activate it and connect the n8n webhook in Settings.`
        : `The ${agent.name} webhook is not configured. Set the webhook URL in Settings or activate the agent after importing n8n workflows.`;

    await query(
      "INSERT INTO chat_messages (agent_id, user_id, role, content) VALUES ($1, $2, 'assistant', $3)",
      [agent.id, req.user!.id, fallback]
    );

    res.json({ reply: fallback, source: "fallback" });
    return;
  }

  const historyResult = await query<{ role: string; content: string }>(
    `SELECT role, content FROM chat_messages
     WHERE agent_id = $1 AND user_id = $2
     ORDER BY created_at DESC LIMIT 10`,
    [agent.id, req.user!.id]
  );

  const knowledgeContext = await retrieveKnowledgeContext(agent.id, message.trim());

  let taskId: string | undefined;
  try {
    const taskInsert = await query<{ id: string }>(
      `INSERT INTO tasks (agent_id, title, status, current_step)
       VALUES ($1, $2, 'running', 'Processing chat message')
       RETURNING id`,
      [agent.id, `Chat: ${message.trim().slice(0, 80)}`]
    );
    taskId = taskInsert.rows[0].id;
  } catch {
    // non-fatal
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AgentDesk-Secret": config.webhookSecret,
      },
      body: JSON.stringify({
        message: message.trim(),
        userId: req.user!.id,
        userName: req.user!.name,
        agentSlug: agent.slug,
        systemPrompt: agent.system_prompt,
        knowledgeContext,
        history: historyResult.rows.reverse(),
        taskId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Webhook returned ${response.status}`);
    }

    const data = (await response.json()) as { reply?: string; taskId?: string };
    const reply =
      data.reply ||
      "I received your message but did not get a valid response from the agent workflow.";

    await query(
      "INSERT INTO chat_messages (agent_id, user_id, role, content) VALUES ($1, $2, 'assistant', $3)",
      [agent.id, req.user!.id, reply]
    );

    if (taskId) {
      await query(
        `UPDATE tasks SET status = 'done', current_step = 'Chat response delivered', updated_at = NOW() WHERE id = $1`,
        [taskId]
      );
    }

    res.json({ reply, source: "n8n", taskId: data.taskId || taskId });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    const reply = `Could not reach the ${agent.name} workflow (${errMsg}). Check that n8n is running and the webhook is active.`;

    await query(
      "INSERT INTO chat_messages (agent_id, user_id, role, content) VALUES ($1, $2, 'assistant', $3)",
      [agent.id, req.user!.id, reply]
    );

    if (taskId) {
      await query(
        `UPDATE tasks SET status = 'failed', error_detail = $2, current_step = 'Webhook error', updated_at = NOW() WHERE id = $1`,
        [taskId, errMsg]
      );
    }

    res.json({ reply, source: "error", taskId });
  }
});

export default router;
