export interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "team_lead" | "team_member";
  team: string | null;
}

export interface WorkspaceUser extends User {
  isActive: boolean;
  createdAt: string;
  teamAccess: { id: string; slug: string; name: string }[];
  projectAccess: { id: string; title: string }[];
}

export interface TeamGroup {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  icon: string | null;
  agentCount: number;
}

export interface Agent {
  id: string;
  slug: string;
  name: string;
  team: string;
  webhookUrl: string | null;
  chatWebhookPath: string | null;
  workflowId: string | null;
  systemPrompt: string | null;
  knowledgeCollectionId: string | null;
  connectedApps: string[];
  isActive: boolean;
  teamGroupId?: string | null;
  parentAgentId?: string | null;
  description?: string | null;
  skills: string[];
  rules: string[];
  constraints: string[];
  avatarColor: string;
  isTemplate?: boolean;
  isClone?: boolean;
  parentAgentName?: string | null;
  shortId?: string;
  projectGroups?: { id: string; title: string }[];
  projectGroupCount?: number;
  teamGroup?: { slug: string; name: string; color: string } | null;
}

export interface Project {
  id: string;
  title: string;
  goal: string | null;
  description: string | null;
  status: string;
  createdAt: string;
  agentCount: number;
}

export interface ProjectAgent {
  membershipId: string;
  role: string;
  skills: string[];
  rules: string[];
  constraints: string[];
  agentId: string;
  slug: string;
  name: string;
  team: string;
  avatarColor: string;
  shortId?: string;
  isTemplate?: boolean;
  isClone?: boolean;
  parentAgentName?: string | null;
  otherProjectCount?: number;
  teamGroup: { slug: string; name: string; color: string } | null;
}

export interface Task {
  id: string;
  agentId: string;
  agentSlug: string;
  agentName: string;
  title: string;
  status: "queued" | "running" | "done" | "failed" | "pending_approval";
  currentStep: string | null;
  executionId: string | null;
  outputRef: string | null;
  parentProjectId: string | null;
  errorDetail: string | null;
  n8nExecutionUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface KnowledgeDocument {
  id: string;
  filename: string;
  fileType: string;
  fileSize: number;
  indexedAt: string | null;
  uploadedAt: string;
}

export interface N8nWorkflowTemplate {
  id: "chat" | "schedule";
  label: string;
  description: string;
  bindsChat: boolean;
}

export interface N8nWorkflowItem {
  id: string;
  name: string;
  active: boolean;
  isLinkedChat?: boolean;
  editorUrl: string;
}

export interface N8nAgentStatus {
  agent: {
    slug: string;
    name: string;
    isActive: boolean;
    chatWebhookPath: string | null;
    workflowId: string | null;
    webhookUrl: string | null;
  };
  n8nBaseUrl: string;
  apiConfigured: boolean;
  n8n: {
    reachable: boolean;
    configured: boolean;
    error?: string;
  };
  linkedWorkflow: { id: string; name: string; active: boolean } | null;
}

const TOKEN_KEY = "agentdesk_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, { ...options, headers });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    const message =
      body.error ||
      body.message ||
      (res.status === 503
        ? "Server unavailable — restart the API (npm run dev) so the database can initialize."
        : `Request failed (${res.status})`);
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

export const api = {
  login: (email: string, password: string) =>
    apiFetch<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  register: (name: string, email: string, password: string) =>
    apiFetch<{ token: string; user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    }),

  getAuthProviders: () =>
    apiFetch<{ google: boolean; allowSignup: boolean }>("/auth/providers"),

  me: () => apiFetch<{ user: User }>("/auth/me"),

  getUsers: () => apiFetch<{ users: WorkspaceUser[] }>("/users"),

  createUser: (data: {
    email: string;
    name: string;
    password: string;
    role?: User["role"];
    team?: string | null;
    teamGroupIds?: string[];
    projectIds?: string[];
  }) => apiFetch<{ user: WorkspaceUser }>("/users", { method: "POST", body: JSON.stringify(data) }),

  updateUser: (
    id: string,
    data: {
      name?: string;
      role?: User["role"];
      team?: string | null;
      isActive?: boolean;
      teamGroupIds?: string[];
      projectIds?: string[];
    }
  ) => apiFetch<{ user: WorkspaceUser }>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  resetUserPassword: (id: string, password: string) =>
    apiFetch<{ reset: boolean }>(`/users/${id}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ password }),
    }),

  deactivateUser: (id: string) =>
    apiFetch<{ deactivated: boolean }>(`/users/${id}`, { method: "DELETE" }),

  getTeams: () => apiFetch<{ teams: TeamGroup[] }>("/teams"),

  getTeam: (slug: string) =>
    apiFetch<{ team: TeamGroup; agents: Agent[] }>(`/teams/${slug}`),

  createTeam: (data: { name: string; description?: string; color?: string; icon?: string }) =>
    apiFetch<{ team: TeamGroup }>("/teams", { method: "POST", body: JSON.stringify(data) }),

  getAgents: (teamGroupId?: string) =>
    apiFetch<{ agents: Agent[] }>(
      `/agents${teamGroupId ? `?teamGroupId=${teamGroupId}` : ""}`
    ),

  getAgent: (slug: string) => apiFetch<{ agent: Agent }>(`/agents/${slug}`),

  updateAgent: (slug: string, data: Partial<Agent>) =>
    apiFetch<{ agent: Agent }>(`/agents/${slug}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  cloneAgent: (
    slug: string,
    data: { name?: string; description?: string; teamGroupId?: string; skills?: string[]; rules?: string[]; constraints?: string[] }
  ) =>
    apiFetch<{ agent: Agent }>(`/agents/${slug}/clone`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  deleteAgent: (slug: string) =>
    apiFetch<{ deleted: boolean }>(`/agents/${slug}`, { method: "DELETE" }),

  getProjects: () => apiFetch<{ projects: Project[] }>("/projects"),

  getProject: (id: string) =>
    apiFetch<{ project: Project; agents: ProjectAgent[] }>(`/projects/${id}`),

  createProject: (data: {
    title: string;
    goal?: string;
    description?: string;
    agentIds?: string[];
  }) => apiFetch<{ projectId: string }>("/projects", { method: "POST", body: JSON.stringify(data) }),

  addProjectAgent: (
    projectId: string,
    data: { agentId: string; role?: string; skills?: string[]; rules?: string[]; constraints?: string[] }
  ) =>
    apiFetch<{ added: boolean }>(`/projects/${projectId}/agents`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateProjectAgent: (
    projectId: string,
    agentId: string,
    data: { role?: string; skills?: string[]; rules?: string[]; constraints?: string[] }
  ) =>
    apiFetch<{ updated: boolean }>(`/projects/${projectId}/agents/${agentId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  removeProjectAgent: (projectId: string, agentId: string) =>
    apiFetch<{ removed: boolean }>(`/projects/${projectId}/agents/${agentId}`, {
      method: "DELETE",
    }),

  updateProject: (projectId: string, data: { title?: string; goal?: string; description?: string }) =>
    apiFetch<{ updated: boolean }>(`/projects/${projectId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteProject: (projectId: string) =>
    apiFetch<{ deleted: boolean }>(`/projects/${projectId}`, { method: "DELETE" }),

  getTasks: (slug: string, status?: string) =>
    apiFetch<{ tasks: Task[] }>(
      `/tasks/agent/${slug}${status ? `?status=${status}` : ""}`
    ),

  getRecentTasks: () => apiFetch<{ tasks: Task[] }>("/tasks/recent"),

  getMessages: (slug: string) =>
    apiFetch<{ messages: ChatMessage[] }>(`/chat/${slug}/messages`),

  sendMessage: (slug: string, message: string) =>
    apiFetch<{ reply: string; source: string; taskId?: string }>(
      `/chat/${slug}/send`,
      { method: "POST", body: JSON.stringify({ message }) }
    ),

  getDocuments: (slug: string) =>
    apiFetch<{ documents: KnowledgeDocument[] }>(`/knowledge/agent/${slug}`),

  uploadDocument: (slug: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return apiFetch<{ documentId: string; chunkCount?: number; indexed: boolean }>(
      `/knowledge/agent/${slug}/upload`,
      { method: "POST", body: form }
    );
  },

  deleteDocument: (documentId: string) =>
    apiFetch<{ deleted: boolean }>(`/knowledge/${documentId}`, { method: "DELETE" }),

  getN8nHealth: () => apiFetch<{ apiConfigured: boolean; reachable: boolean; error?: string }>("/n8n/health"),

  getN8nTemplates: () => apiFetch<{ templates: N8nWorkflowTemplate[] }>("/n8n/templates"),

  getN8nAgentStatus: (slug: string) => apiFetch<N8nAgentStatus>(`/n8n/agents/${slug}/status`),

  getN8nWorkflows: (slug: string) =>
    apiFetch<{ workflows: N8nWorkflowItem[] }>(`/n8n/agents/${slug}/workflows`),

  createN8nWorkflow: (slug: string, data: { template: "chat" | "schedule"; activate?: boolean }) =>
    apiFetch<{ workflow: N8nWorkflowItem & { webhookPath?: string; webhookUrl?: string }; boundToAgent: boolean }>(
      `/n8n/agents/${slug}/workflows`,
      { method: "POST", body: JSON.stringify(data) }
    ),

  activateN8nWorkflow: (slug: string, workflowId: string) =>
    apiFetch<{ workflow: { id: string; name: string; active: boolean } }>(
      `/n8n/agents/${slug}/workflows/${workflowId}/activate`,
      { method: "POST" }
    ),

  deactivateN8nWorkflow: (slug: string, workflowId: string) =>
    apiFetch<{ workflow: { id: string; name: string; active: boolean } }>(
      `/n8n/agents/${slug}/workflows/${workflowId}/deactivate`,
      { method: "POST" }
    ),

  deleteN8nWorkflow: (slug: string, workflowId: string) =>
    apiFetch<{ deleted: boolean }>(`/n8n/agents/${slug}/workflows/${workflowId}`, {
      method: "DELETE",
    }),

  testN8nWebhook: (slug: string, message?: string) =>
    apiFetch<{ ok: boolean; status?: number; webhookUrl?: string; response?: unknown; error?: string }>(
      `/n8n/agents/${slug}/test-webhook`,
      { method: "POST", body: JSON.stringify({ message }) }
    ),
};
