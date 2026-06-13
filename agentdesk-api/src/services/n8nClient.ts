import { config } from "../config.js";

export interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
  nodes?: unknown[];
  connections?: Record<string, unknown>;
}

export interface N8nWorkflowCreatePayload {
  name: string;
  nodes: unknown[];
  connections: Record<string, unknown>;
  settings?: Record<string, unknown>;
}

class N8nClientError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function apiBase(): string {
  return `${config.n8nBaseUrl.replace(/\/$/, "")}/api/v1`;
}

function headers(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (config.n8nApiKey) h["X-N8N-API-KEY"] = config.n8nApiKey;
  return h;
}

export function isN8nApiConfigured(): boolean {
  return !!config.n8nApiKey?.trim();
}

async function n8nFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!isN8nApiConfigured()) {
    throw new N8nClientError(
      "N8N_API_KEY is not set. Add it in .env (n8n → Settings → API).",
      503
    );
  }

  const res = await fetch(`${apiBase()}${path}`, {
    ...options,
    headers: { ...headers(), ...(options.headers as Record<string, string>) },
  });

  const text = await res.text();
  let body: { message?: string } = {};
  try {
    body = text ? (JSON.parse(text) as { message?: string }) : {};
  } catch {
    /* non-json */
  }

  if (!res.ok) {
    throw new N8nClientError(body.message || text || `n8n API error ${res.status}`, res.status);
  }

  return (text ? JSON.parse(text) : {}) as T;
}

export async function n8nHealthCheck(): Promise<{ reachable: boolean; configured: boolean; error?: string }> {
  if (!isN8nApiConfigured()) {
    return { reachable: false, configured: false, error: "N8N_API_KEY not configured" };
  }
  try {
    await n8nFetch<{ data?: N8nWorkflow[] }>("/workflows?limit=1");
    return { reachable: true, configured: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { reachable: false, configured: true, error: msg };
  }
}

export async function listWorkflows(): Promise<N8nWorkflow[]> {
  const result = await n8nFetch<{ data: N8nWorkflow[] }>("/workflows?limit=250");
  return result.data ?? [];
}

export async function getWorkflow(id: string): Promise<N8nWorkflow> {
  return n8nFetch<N8nWorkflow>(`/workflows/${id}`);
}

export async function createWorkflow(payload: N8nWorkflowCreatePayload): Promise<N8nWorkflow> {
  return n8nFetch<N8nWorkflow>("/workflows", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function activateWorkflow(id: string): Promise<N8nWorkflow> {
  return n8nFetch<N8nWorkflow>(`/workflows/${id}/activate`, { method: "POST" });
}

export async function deactivateWorkflow(id: string): Promise<N8nWorkflow> {
  return n8nFetch<N8nWorkflow>(`/workflows/${id}/deactivate`, { method: "POST" });
}

export async function deleteWorkflow(id: string): Promise<void> {
  await n8nFetch(`/workflows/${id}`, { method: "DELETE" });
}

export { N8nClientError };
