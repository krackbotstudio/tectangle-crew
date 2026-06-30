import { Router } from "express";
import { query } from "../db.js";
import { authRequired, adminRequired } from "../middleware/auth.js";
import { config } from "../config.js";
import { LOGO_WORDMARK } from "../brand.js";
import {
  activateWorkflow,
  createWorkflow,
  deactivateWorkflow,
  deleteWorkflow,
  getWorkflow,
  isN8nApiConfigured,
  listWorkflows,
  n8nHealthCheck,
  N8nClientError,
} from "../services/n8nClient.js";
import {
  buildWorkflowFromTemplate,
  filterWorkflowsForAgent,
  WORKFLOW_TEMPLATES,
  type WorkflowTemplateType,
} from "../services/workflowTemplates.js";

const router = Router();

async function getAgentBySlug(slug: string) {
  const result = await query<{
    id: string;
    slug: string;
    name: string;
    system_prompt: string | null;
    chat_webhook_path: string | null;
    workflow_id: string | null;
    is_active: boolean;
  }>("SELECT id, slug, name, system_prompt, chat_webhook_path, workflow_id, is_active FROM agents WHERE slug = $1", [
    slug,
  ]);
  return result.rows[0] ?? null;
}

router.get("/health", authRequired, async (_req, res) => {
  const n8n = await n8nHealthCheck();
  res.json({
    n8nBaseUrl: config.n8nBaseUrl,
    apiConfigured: isN8nApiConfigured(),
    ...n8n,
  });
});

router.get("/templates", authRequired, (_req, res) => {
  res.json({ templates: WORKFLOW_TEMPLATES });
});

router.get("/agents/:slug/status", authRequired, async (req, res) => {
  const slug = String(req.params.slug);
  const agent = await getAgentBySlug(slug);
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  const n8n = await n8nHealthCheck();
  let linkedWorkflow: { id: string; name: string; active: boolean } | null = null;

  if (n8n.reachable && agent.workflow_id) {
    try {
      const wf = await getWorkflow(agent.workflow_id);
      linkedWorkflow = { id: wf.id, name: wf.name, active: wf.active };
    } catch {
      linkedWorkflow = null;
    }
  }

  res.json({
    agent: {
      slug: agent.slug,
      name: agent.name,
      isActive: agent.is_active,
      chatWebhookPath: agent.chat_webhook_path,
      workflowId: agent.workflow_id,
      webhookUrl: agent.chat_webhook_path
        ? `${config.n8nBaseUrl}/webhook/${agent.chat_webhook_path}`
        : null,
    },
    n8nBaseUrl: config.n8nBaseUrl,
    apiConfigured: isN8nApiConfigured(),
    n8n,
    linkedWorkflow,
  });
});

router.get("/agents/:slug/workflows", authRequired, async (req, res) => {
  const slug = String(req.params.slug);
  const agent = await getAgentBySlug(slug);
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  try {
    const all = await listWorkflows();
    const workflows = filterWorkflowsForAgent(all, agent.slug).map((w) => ({
      ...w,
      isLinkedChat: w.id === agent.workflow_id,
      editorUrl: `${config.n8nBaseUrl}/workflow/${w.id}`,
    }));
    res.json({ workflows });
  } catch (e) {
    const status = e instanceof N8nClientError ? e.status : 502;
    res.status(status).json({ error: e instanceof Error ? e.message : "Failed to list workflows" });
  }
});

router.post("/agents/:slug/workflows", authRequired, adminRequired, async (req, res) => {
  const slug = String(req.params.slug);
  const { template, activate = true } = req.body as {
    template?: WorkflowTemplateType;
    activate?: boolean;
  };

  if (!template || !WORKFLOW_TEMPLATES.some((t) => t.id === template)) {
    res.status(400).json({ error: "template must be 'chat' or 'schedule'" });
    return;
  }

  const agent = await getAgentBySlug(slug);
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  try {
    const built = await buildWorkflowFromTemplate(template, agent.slug, {
      systemPrompt: agent.system_prompt,
      agentName: agent.name,
    });

    const existing = (await listWorkflows()).find((w) => w.name === built.name);
    let workflow = existing;

    if (workflow) {
      res.status(409).json({
        error: `Workflow "${built.name}" already exists in n8n. Activate it or delete it from n8n first.`,
        workflowId: workflow.id,
      });
      return;
    }

    workflow = await createWorkflow(built.payload);

    if (activate) {
      workflow = await activateWorkflow(workflow.id);
    }

    const meta = WORKFLOW_TEMPLATES.find((t) => t.id === template)!;

    if (meta.bindsChat) {
      await query(
        `UPDATE agents SET
          chat_webhook_path = $2,
          workflow_id = $3,
          is_active = $4,
          updated_at = NOW()
         WHERE id = $1`,
        [agent.id, built.webhookPath, workflow.id, activate]
      );
    }

    res.status(201).json({
      workflow: {
        id: workflow.id,
        name: workflow.name,
        active: workflow.active,
        webhookPath: built.webhookPath || null,
        webhookUrl: built.webhookPath ? `${config.n8nBaseUrl}/webhook/${built.webhookPath}` : null,
        editorUrl: `${config.n8nBaseUrl}/workflow/${workflow.id}`,
      },
      boundToAgent: meta.bindsChat,
    });
  } catch (e) {
    const status = e instanceof N8nClientError ? e.status : 500;
    res.status(status).json({ error: e instanceof Error ? e.message : "Failed to create workflow" });
  }
});

router.post("/agents/:slug/workflows/:workflowId/activate", authRequired, adminRequired, async (req, res) => {
  const slug = String(req.params.slug);
  const workflowId = String(req.params.workflowId);
  const agent = await getAgentBySlug(slug);
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  try {
    const workflow = await activateWorkflow(workflowId);

    if (agent.workflow_id === workflowId || workflow.name === `${agent.slug}-agent-chat`) {
      await query(
        `UPDATE agents SET is_active = true, workflow_id = COALESCE(workflow_id, $2), updated_at = NOW() WHERE id = $1`,
        [agent.id, workflow.id]
      );
    }

    res.json({ workflow: { id: workflow.id, name: workflow.name, active: workflow.active } });
  } catch (e) {
    const status = e instanceof N8nClientError ? e.status : 500;
    res.status(status).json({ error: e instanceof Error ? e.message : "Failed to activate workflow" });
  }
});

router.post("/agents/:slug/workflows/:workflowId/deactivate", authRequired, adminRequired, async (req, res) => {
  const slug = String(req.params.slug);
  const workflowId = String(req.params.workflowId);
  const agent = await getAgentBySlug(slug);
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  try {
    const workflow = await deactivateWorkflow(workflowId);

    if (agent.workflow_id === workflowId) {
      await query(`UPDATE agents SET is_active = false, updated_at = NOW() WHERE id = $1`, [agent.id]);
    }

    res.json({ workflow: { id: workflow.id, name: workflow.name, active: workflow.active } });
  } catch (e) {
    const status = e instanceof N8nClientError ? e.status : 500;
    res.status(status).json({ error: e instanceof Error ? e.message : "Failed to deactivate workflow" });
  }
});

router.delete("/agents/:slug/workflows/:workflowId", authRequired, adminRequired, async (req, res) => {
  const slug = String(req.params.slug);
  const workflowId = String(req.params.workflowId);
  const agent = await getAgentBySlug(slug);
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  try {
    await deleteWorkflow(workflowId);

    if (agent.workflow_id === workflowId) {
      await query(
        `UPDATE agents SET workflow_id = NULL, chat_webhook_path = NULL, is_active = false, updated_at = NOW() WHERE id = $1`,
        [agent.id]
      );
    }

    res.json({ deleted: true });
  } catch (e) {
    const status = e instanceof N8nClientError ? e.status : 500;
    res.status(status).json({ error: e instanceof Error ? e.message : "Failed to delete workflow" });
  }
});

router.post("/agents/:slug/test-webhook", authRequired, adminRequired, async (req, res) => {
  const slug = String(req.params.slug);
  const agent = await getAgentBySlug(slug);
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  const webhookUrl = agent.chat_webhook_path
    ? `${config.n8nBaseUrl}/webhook/${agent.chat_webhook_path}`
    : null;

  if (!webhookUrl) {
    res.status(400).json({ error: "No chat webhook configured for this agent" });
    return;
  }

  const testMessage = (req.body as { message?: string }).message ?? `Hello from ${LOGO_WORDMARK} — webhook test.`;

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AgentDesk-Secret": config.webhookSecret,
      },
      body: JSON.stringify({
        message: testMessage,
        agentSlug: agent.slug,
        systemPrompt: agent.system_prompt,
        knowledgeContext: "",
        history: [],
        taskId: null,
        test: true,
      }),
    });

    const text = await response.text();
    let data: unknown = text;
    try {
      data = JSON.parse(text);
    } catch {
      /* plain text */
    }

    res.json({
      ok: response.ok,
      status: response.status,
      webhookUrl,
      response: data,
    });
  } catch (e) {
    res.status(502).json({
      ok: false,
      error: e instanceof Error ? e.message : "Webhook request failed",
      webhookUrl,
    });
  }
});

export default router;
