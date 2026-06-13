import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "../config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type WorkflowTemplateType = "chat" | "schedule";

const TEMPLATE_FILES: Record<WorkflowTemplateType, string> = {
  chat: "content-agent-chat.json",
  schedule: "content-agent-daily-draft.json",
};

export const WORKFLOW_TEMPLATES: {
  id: WorkflowTemplateType;
  label: string;
  description: string;
  bindsChat: boolean;
}[] = [
  {
    id: "chat",
    label: "Chat agent",
    description: "Webhook → status log → Claude → reply. Powers the agent chat tab.",
    bindsChat: true,
  },
  {
    id: "schedule",
    label: "Daily schedule",
    description: "Runs every day at 9:00 AM and logs a task with generated drafts.",
    bindsChat: false,
  },
];

async function loadTemplateFile(type: WorkflowTemplateType): Promise<string> {
  const filename = TEMPLATE_FILES[type];
  const candidates = [
    path.resolve(__dirname, "../../../agentdesk-n8n/workflows", filename),
    path.resolve(__dirname, "../../agentdesk-n8n/workflows", filename),
    path.resolve(process.cwd(), "agentdesk-n8n/workflows", filename),
    path.resolve(process.cwd(), "../agentdesk-n8n/workflows", filename),
  ];

  for (const filePath of candidates) {
    try {
      return await fs.readFile(filePath, "utf-8");
    } catch {
      continue;
    }
  }

  throw new Error(`Workflow template not found: ${filename}`);
}

function workflowNames(agentSlug: string, type: WorkflowTemplateType): { name: string; webhookPath: string } {
  if (type === "chat") {
    const pathSegment = `${agentSlug}-agent-chat`;
    return { name: pathSegment, webhookPath: pathSegment };
  }
  return { name: `${agentSlug}-daily-draft`, webhookPath: "" };
}

export async function buildWorkflowFromTemplate(
  type: WorkflowTemplateType,
  agentSlug: string,
  options?: { systemPrompt?: string | null; agentName?: string }
): Promise<{ name: string; webhookPath: string; payload: { name: string; nodes: unknown[]; connections: Record<string, unknown>; settings: Record<string, unknown> } }> {
  const raw = await loadTemplateFile(type);
  const { name, webhookPath } = workflowNames(agentSlug, type);

  let json = raw
    .replace(/content-agent-chat/g, webhookPath || name)
    .replace(/content-agent-daily-draft/g, name)
    .replace(/\\"agentSlug\\": \\"content\\"/g, `\\"agentSlug\\": \\"${agentSlug}\\"`)
    .replace(/"agentSlug": "content"/g, `"agentSlug": "${agentSlug}"`)
    .replace(/agentdesk-dev-secret/g, config.webhookSecret);

  const defaultPrompt =
    options?.systemPrompt?.trim() ||
    `You are the ${options?.agentName ?? agentSlug} agent for Agent Desk.`;

  json = json.replace(/You are the Content Agent\./g, defaultPrompt.replace(/\\/g, "\\\\").replace(/"/g, '\\"'));

  const parsed = JSON.parse(json) as {
    name: string;
    nodes: unknown[];
    connections: Record<string, unknown>;
    settings?: Record<string, unknown>;
  };

  parsed.name = name;

  if (type === "chat" && webhookPath) {
    for (const node of parsed.nodes as Array<{ type?: string; parameters?: Record<string, unknown>; webhookId?: string }>) {
      if (node.type === "n8n-nodes-base.webhook") {
        node.parameters = { ...node.parameters, path: webhookPath };
        node.webhookId = webhookPath;
      }
    }
  }

  return {
    name,
    webhookPath,
    payload: {
      name: parsed.name,
      nodes: parsed.nodes,
      connections: parsed.connections,
      settings: parsed.settings ?? { executionOrder: "v1" },
    },
  };
}

export function filterWorkflowsForAgent(
  workflows: { id: string; name: string; active: boolean }[],
  agentSlug: string
): { id: string; name: string; active: boolean }[] {
  const prefix = `${agentSlug}-`;
  return workflows.filter((w) => w.name.startsWith(prefix) || w.name === `${agentSlug}-agent-chat`);
}
