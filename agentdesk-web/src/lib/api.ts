export type BuiltinAiProviderId = "anthropic" | "openai" | "google";
export type AiProviderRef = "auto" | BuiltinAiProviderId | string;

export interface AiCustomProvider {
  id: string;
  ref: string;
  name: string;
  kind: "openai_compatible";
  baseUrl: string;
  enabled: boolean;
  configured: boolean;
  apiKeyHint: string | null;
  defaultModel: string;
  discoveredModels: string[];
}

export interface AiSettingsResponse {
  defaultProvider: AiProviderRef;
  defaultModel: string;
  autoAvailable: boolean;
  configuredProviders: string[];
  providers: Record<
    BuiltinAiProviderId,
    {
      enabled: boolean;
      configured: boolean;
      apiKeyHint: string | null;
      defaultModel: string;
    }
  >;
  customProviders: AiCustomProvider[];
  catalog: Record<BuiltinAiProviderId, { label: string; models: { id: string; label: string }[] }>;
  providerTemplates: Array<{ name: string; baseUrl: string; defaultModel: string }>;
}

export interface UpdateAiSettingsPayload {
  defaultProvider?: AiProviderRef;
  defaultModel?: string;
  providers?: {
    anthropic?: { enabled?: boolean; apiKey?: string | null; defaultModel?: string };
    openai?: { enabled?: boolean; apiKey?: string | null; defaultModel?: string };
    google?: { enabled?: boolean; apiKey?: string | null; defaultModel?: string };
  };
  customProviders?: Array<{
    id?: string;
    name?: string;
    baseUrl?: string;
    enabled?: boolean;
    apiKey?: string | null;
    clearApiKey?: boolean;
    defaultModel?: string;
  }>;
  removeCustomProviderIds?: string[];
}

/** @deprecated use AiProviderRef */
export type AiProviderId = BuiltinAiProviderId;

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
  rules?: string[];
  constraints?: string[];
}

export interface TeamAssignedProject {
  id: string;
  title: string;
  description: string | null;
  status: string;
  teamAgentCount: number;
  workProjectId: string | null;
}

export type TeamToolRequestStatus = "requested" | "approved" | "rejected" | "provisioned";

export interface TeamToolRequest {
  id: string;
  teamGroupId: string;
  projectId: string | null;
  projectTitle: string | null;
  toolName: string;
  category: string;
  reason: string | null;
  url: string | null;
  status: TeamToolRequestStatus;
  requestedBy: string | null;
  requesterName: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ProjectToolStatus = "planned" | "requested" | "approved" | "connected" | "disabled";

export interface ProjectTool {
  id: string;
  projectId: string;
  toolSlug: string;
  toolName: string;
  category: string;
  capabilities: string[];
  status: ProjectToolStatus;
  projectStatus?: ProjectToolStatus;
  notes: string | null;
  description: string | null;
  connectVia: string | null;
  workspaceStatus?: IntegrationStatus | "not_configured";
  accountLabel?: string | null;
  connectionType?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ToolCatalogResponse {
  categories: { id: string; label: string }[];
  tools: Array<{
    slug: string;
    name: string;
    category: string;
    description: string;
    capabilities: string[];
    connectVia?: string;
  }>;
  stacks: Array<{
    id: string;
    name: string;
    description: string;
    toolSlugs: string[];
  }>;
}

export type IntegrationConnectionType = "oauth" | "api_key" | "mcp" | "n8n" | "manual";
export type IntegrationStatus = "not_configured" | "configured" | "connected" | "error" | "disabled";
export type McpTransport = "stdio" | "sse" | "http";

export interface IntegrationCredentialsMasked {
  apiKey: string | null;
  apiSecret: string | null;
  anonKey: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  clientId: string | null;
  clientSecret: string | null;
  webhookSecret: string | null;
}

export interface WorkspaceIntegration {
  id: string;
  toolSlug: string;
  toolName: string;
  category: string;
  connectionType: IntegrationConnectionType;
  status: IntegrationStatus;
  accountLabel: string | null;
  config: Record<string, unknown>;
  credentials: IntegrationCredentialsMasked;
  hasCredentials: boolean;
  notes: string | null;
  description: string | null;
  capabilities: string[];
  connectVia: string | null;
  lastTestedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConsoleLibraryItem {
  slug: string;
  name: string;
  category: string;
  description: string;
  capabilities: string[];
  connectVia?: string;
  liveIntegration?: boolean;
  setupHint?: string;
  integration: WorkspaceIntegration | null;
}

export interface McpConnector {
  id: string;
  name: string;
  description: string | null;
  transport: McpTransport;
  serverUrl: string | null;
  command: string | null;
  args: string[];
  envKeys: string[];
  credentials: IntegrationCredentialsMasked;
  hasCredentials: boolean;
  status: IntegrationStatus;
  notes: string | null;
  lastTestedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConsoleResponse {
  catalog: {
    categories: { id: string; label: string }[];
    stacks: ToolCatalogResponse["stacks"];
  };
  library: ConsoleLibraryItem[];
  integrations: WorkspaceIntegration[];
  mcpConnectors: McpConnector[];
  stats: {
    catalogCount: number;
    configuredCount: number;
    connectedCount: number;
    mcpCount: number;
  };
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
  isProjectAgent?: boolean;
  parentAgentName?: string | null;
  shortId?: string;
  projectGroups?: { id: string; title: string }[];
  projectGroupCount?: number;
  teamGroup?: { slug: string; name: string; color: string } | null;
  chatMode?: "direct" | "n8n";
  llmProvider?: string | null;
  llmModel?: string | null;
  llmTemperature?: number;
  templateVisibility?: "public" | "private";
  createdById?: string | null;
  creatorName?: string | null;
  isOwner?: boolean;
}

export type AgentBoardColumnSide = "input" | "output";

export type AgentBoardCard = {
  id: string;
  agentId: string;
  columnSide: AgentBoardColumnSide;
  cardType: string;
  title: string;
  description: string | null;
  config: Record<string, unknown>;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export interface ProjectGroupAgentSummary {
  slug: string;
  name: string;
  avatarColor?: string | null;
}

export interface Project {
  id: string;
  title: string;
  goal: string | null;
  description: string | null;
  status: string;
  createdAt: string;
  agentCount: number;
  workProjectId?: string | null;
  agents?: ProjectGroupAgentSummary[];
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
  isProjectAgent?: boolean;
  parentAgentName?: string | null;
  templateAgentId?: string | null;
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

export type WorkScheduleType = "one_time" | "scheduled" | "recurring";
export type WorkItemStatus = "todo" | "in_progress" | "done" | "cancelled" | "scheduled";
export type WorkPriority = "low" | "medium" | "high";

export interface WorkProject {
  id: string;
  projectGroupId?: string | null;
  title: string;
  description: string | null;
  status: string;
  startDate: string | null;
  dueDate: string | null;
  activityCount: number;
  taskCount: number;
  createdAt: string;
  updatedAt: string;
  activities: WorkActivity[];
}

export interface WorkActivity {
  id: string;
  workProjectId: string | null;
  linkedProjectIds?: string[];
  sourceActivityId?: string | null;
  projectTitle?: string;
  title: string;
  description: string | null;
  agentId: string | null;
  agentSlug: string | null;
  agentName: string | null;
  agentColor: string | null;
  status: WorkItemStatus;
  scheduleType: WorkScheduleType;
  scheduledAt: string | null;
  recurrenceRule: string | null;
  recurrenceEndAt: string | null;
  nextRunAt: string | null;
  priority: WorkPriority;
  createdAt: string;
  updatedAt: string;
  tasks?: WorkTask[];
}

export interface WorkTask {
  id: string;
  workProjectId: string | null;
  activityId: string | null;
  sourceTaskId?: string | null;
  title: string;
  description: string | null;
  agentId: string | null;
  agentSlug: string | null;
  agentName: string | null;
  agentColor: string | null;
  status: WorkItemStatus;
  scheduleType: WorkScheduleType;
  scheduledAt: string | null;
  recurrenceRule: string | null;
  recurrenceEndAt: string | null;
  nextRunAt: string | null;
  priority: WorkPriority;
  createdAt: string;
  updatedAt: string;
}

export interface WorkHub {
  projects: WorkProject[];
  projectActivities: WorkActivity[];
  standaloneActivities: WorkActivity[];
  standaloneTasks: WorkTask[];
  allActivities: WorkActivity[];
  allTasks: WorkTask[];
}

export interface SocialAccount {
  id: string;
  platform: string;
  handle: string;
  displayName: string | null;
  profileUrl: string | null;
  integrationSlug: string | null;
  config: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type SocialAccountInput = {
  handle?: string;
  displayName?: string;
  profileUrl?: string;
  integrationSlug?: string;
  config?: Record<string, unknown>;
  isActive?: boolean;
};

export interface SocialPost {
  id: string;
  projectId: string | null;
  agentId: string | null;
  socialAccountId: string | null;
  creativeId: string | null;
  platform: string;
  content: string;
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  externalPostId: string | null;
  errorDetail: string | null;
  handle: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface NetworkCommunity {
  id: string;
  slug: string;
  name: string;
  platform: string;
  url: string;
  description: string | null;
  industries: string[];
  interests: string[];
  productTypes: string[];
  audienceSize: string | null;
  activityLevel: string | null;
  joinType: string;
  ownedSocialPlatform: string | null;
  rulesNotes: string | null;
  isActive: boolean;
  fitScore?: number;
  fitReasons?: string[];
}

export interface NetworkGtmProfile {
  id: string;
  projectId: string | null;
  productName: string | null;
  productType: string | null;
  industry: string | null;
  icp: string | null;
  offer: string | null;
  stage: string;
  goals: string[];
  interests: string[];
  brandVoice: string | null;
  geography: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NetworkCampaign {
  id: string;
  projectId: string | null;
  gtmProfileId: string | null;
  title: string;
  goal: string | null;
  status: string;
  brief: string | null;
  collateral: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface NetworkCampaignJob {
  id: string;
  campaignId: string;
  communityId: string | null;
  communityName: string | null;
  channelType: string;
  platform: string;
  destinationLabel: string | null;
  destinationUrl: string | null;
  content: string;
  collateralType: string;
  status: string;
  socialPostId: string | null;
  creativeId: string | null;
  creativeDownloadUrl: string | null;
  externalRef: string | null;
  errorDetail: string | null;
  outcome: string | null;
  publishedAt: string | null;
  completedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface NetworkMembership {
  id: string;
  communityId: string;
  status: string;
  fitScore: number | null;
  fitReason: string | null;
  name: string;
  platform: string;
  url: string;
}

export interface NetworkCollateralPack {
  launchPost: string;
  shortDm: string;
  commentReply: string;
  waitlistCta: string;
  linkedinPost: string;
  xPost: string;
  summary: string;
}

export interface NetworkCreativeItem {
  creativeId: string;
  communityId: string | null;
  platform: string;
  label: string;
  purpose: string;
  downloadUrl: string;
  width: number | null;
  height: number | null;
  prompt: string;
}

export interface BrandGuidelines {
  id: string;
  companyName: string | null;
  tagline: string | null;
  logoFileName: string | null;
  logoUrl: string | null;
  logoAltText: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  fontPrimary: string | null;
  fontSecondary: string | null;
  imageStyle: string;
  visualKeywords: string[];
  logoPlacement: string;
  doNotes: string | null;
  dontNotes: string | null;
  extraRules: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentCreative {
  id: string;
  projectId: string | null;
  agentId: string;
  messageId: string | null;
  prompt: string;
  purpose: string | null;
  width: number | null;
  height: number | null;
  fileName: string;
  mimeType: string;
  provider: string | null;
  status: "generated" | "scheduled" | "published" | "failed";
  publishPlatform: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  downloadUrl: string;
  createdAt: string;
}

export interface AgentQuestion {
  id: string;
  label: string;
  type: "text" | "single" | "multi";
  placeholder?: string;
  options?: string[];
  required?: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  agentId?: string;
  agentName?: string;
  avatarColor?: string;
  metadata?: Record<string, unknown>;
  creatives?: AgentCreative[];
  questions?: AgentQuestion[];
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

    if (
      res.status === 401 &&
      !path.startsWith("/auth/login") &&
      !path.startsWith("/auth/register")
    ) {
      setToken(null);
      window.dispatchEvent(new CustomEvent("agentdesk:session-expired"));
    }

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
    apiFetch<{
      team: TeamGroup;
      agents: Agent[];
      projects: TeamAssignedProject[];
      toolRequests: TeamToolRequest[];
    }>(`/teams/${slug}`),

  updateTeam: (
    slug: string,
    data: { description?: string | null; rules?: string[]; constraints?: string[] }
  ) => apiFetch<{ team: TeamGroup }>(`/teams/${slug}`, { method: "PATCH", body: JSON.stringify(data) }),

  createTeamToolRequest: (
    slug: string,
    data: { projectId?: string; toolName: string; category?: string; reason?: string; url?: string }
  ) =>
    apiFetch<{ request: TeamToolRequest }>(`/teams/${slug}/tool-requests`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateTeamToolRequest: (slug: string, requestId: string, data: { status: TeamToolRequestStatus }) =>
    apiFetch<{ request: TeamToolRequest }>(`/teams/${slug}/tool-requests/${requestId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteTeamToolRequest: (slug: string, requestId: string) =>
    apiFetch<{ deleted: boolean }>(`/teams/${slug}/tool-requests/${requestId}`, { method: "DELETE" }),

  createTeam: (data: { name: string; description?: string; color?: string; icon?: string }) =>
    apiFetch<{ team: TeamGroup }>("/teams", { method: "POST", body: JSON.stringify(data) }),

  getAgents: (teamGroupId?: string) =>
    apiFetch<{ agents: Agent[] }>(
      `/agents${teamGroupId ? `?teamGroupId=${teamGroupId}` : ""}`
    ),

  getAgentTemplates: (mineOnly?: boolean) =>
    apiFetch<{ agents: Agent[] }>(
      `/agents?templatesOnly=true${mineOnly ? "&mineOnly=true" : ""}`
    ),

  createAgentTemplate: (data: {
    name: string;
    description?: string;
    teamGroupId?: string;
    skills?: string[];
    rules?: string[];
    constraints?: string[];
    systemPrompt?: string;
    templateVisibility?: "public" | "private";
    avatarColor?: string;
    sourceSlug?: string;
  }) =>
    apiFetch<{ agent: Agent }>("/agents/templates", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getAgent: (slug: string) => apiFetch<{ agent: Agent }>(`/agents/${slug}`),

  getAgentBoard: (slug: string) =>
    apiFetch<{ cards: AgentBoardCard[] }>(`/agents/${slug}/board`),

  createAgentBoardCard: (
    slug: string,
    data: {
      columnSide: AgentBoardColumnSide;
      cardType: string;
      title: string;
      description?: string;
      config?: Record<string, unknown>;
      sortOrder?: number;
    }
  ) => apiFetch<{ card: AgentBoardCard }>(`/agents/${slug}/board/cards`, { method: "POST", body: JSON.stringify(data) }),

  updateAgentBoardCard: (
    slug: string,
    cardId: string,
    data: {
      title?: string;
      description?: string;
      config?: Record<string, unknown>;
      sortOrder?: number;
    }
  ) =>
    apiFetch<{ card: AgentBoardCard }>(`/agents/${slug}/board/cards/${cardId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteAgentBoardCard: (slug: string, cardId: string) =>
    apiFetch<{ deleted: boolean }>(`/agents/${slug}/board/cards/${cardId}`, { method: "DELETE" }),

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
    apiFetch<{ added: boolean; agentId: string; slug: string; name: string }>(`/projects/${projectId}/agents`, {
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

  getAiProjectSetup: (description: string) =>
    apiFetch<{
      title: string;
      goal: string;
      description: string;
      agents: {
        agentId: string;
        role: string;
        skills: string[];
        rules: string[];
      }[];
    }>("/projects/ai-setup", {
      method: "POST",
      body: JSON.stringify({ description }),
    }),

  getToolCatalog: () => apiFetch<ToolCatalogResponse>("/tools/catalog"),

  getProjectTools: (projectId: string) =>
    apiFetch<{ tools: ProjectTool[] }>(`/projects/${projectId}/tools`),

  addProjectTool: (projectId: string, data: { toolSlug: string; notes?: string; status?: ProjectToolStatus }) =>
    apiFetch<{ tool: ProjectTool }>(`/projects/${projectId}/tools`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  applyProjectToolStack: (projectId: string, stackId: string) =>
    apiFetch<{ tools: ProjectTool[] }>(`/projects/${projectId}/tools`, {
      method: "POST",
      body: JSON.stringify({ stackId }),
    }),

  updateProjectTool: (
    projectId: string,
    toolId: string,
    data: { status?: ProjectToolStatus; notes?: string | null }
  ) =>
    apiFetch<{ tool: ProjectTool }>(`/projects/${projectId}/tools/${toolId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  removeProjectTool: (projectId: string, toolId: string) =>
    apiFetch<{ deleted: boolean }>(`/projects/${projectId}/tools/${toolId}`, {
      method: "DELETE",
    }),

  getConsole: () => apiFetch<ConsoleResponse>("/console"),

  upsertWorkspaceIntegration: (
    toolSlug: string,
    data: {
      connectionType?: IntegrationConnectionType;
      status?: IntegrationStatus;
      accountLabel?: string | null;
      config?: Record<string, unknown>;
      credentials?: Partial<Record<keyof IntegrationCredentialsMasked, string>>;
      notes?: string | null;
    }
  ) =>
    apiFetch<{ integration: WorkspaceIntegration }>(`/console/integrations/${toolSlug}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteWorkspaceIntegration: (toolSlug: string) =>
    apiFetch<{ deleted: boolean }>(`/console/integrations/${toolSlug}`, { method: "DELETE" }),

  testWorkspaceIntegration: (toolSlug: string) =>
    apiFetch<{ ok: boolean; message?: string }>(`/console/integrations/${toolSlug}/test`, {
      method: "POST",
    }),

  createMcpConnector: (data: {
    name: string;
    description?: string;
    transport?: McpTransport;
    serverUrl?: string;
    command?: string;
    args?: string[];
    envKeys?: string[];
    credentials?: Partial<Record<keyof IntegrationCredentialsMasked, string>>;
    status?: IntegrationStatus;
    notes?: string;
  }) =>
    apiFetch<{ connector: McpConnector }>("/console/mcp-connectors", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateMcpConnector: (
    id: string,
    data: Partial<{
      name: string;
      description: string | null;
      transport: McpTransport;
      serverUrl: string | null;
      command: string | null;
      args: string[];
      envKeys: string[];
      credentials: Partial<Record<keyof IntegrationCredentialsMasked, string>>;
      status: IntegrationStatus;
      notes: string | null;
    }>
  ) =>
    apiFetch<{ connector: McpConnector }>(`/console/mcp-connectors/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteMcpConnector: (id: string) =>
    apiFetch<{ deleted: boolean }>(`/console/mcp-connectors/${id}`, { method: "DELETE" }),

  getTasks: (slug: string, status?: string) =>
    apiFetch<{ tasks: Task[] }>(
      `/tasks/agent/${slug}${status ? `?status=${status}` : ""}`
    ),

  getRecentTasks: () => apiFetch<{ tasks: Task[] }>("/tasks/recent"),

  getWorkHub: () => apiFetch<WorkHub>("/work/hub"),

  createWorkProject: (data: {
    title: string;
    description?: string;
    status?: string;
    startDate?: string | null;
    dueDate?: string | null;
  }) => apiFetch<{ project: WorkProject }>("/work/projects", { method: "POST", body: JSON.stringify(data) }),

  addWorkProjectFromGroup: (projectGroupId: string) =>
    apiFetch<{ project: WorkProject }>("/work/projects/from-group", {
      method: "POST",
      body: JSON.stringify({ projectGroupId }),
    }),

  updateWorkProject: (
    id: string,
    data: { title?: string; description?: string; status?: string; startDate?: string | null; dueDate?: string | null }
  ) => apiFetch<{ updated: boolean }>(`/work/projects/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  deleteWorkProject: (id: string) =>
    apiFetch<{ deleted: boolean }>(`/work/projects/${id}`, { method: "DELETE" }),

  createWorkActivity: (data: {
    title: string;
    description?: string;
    workProjectId?: string | null;
    agentId?: string | null;
    scheduleType?: WorkScheduleType;
    scheduledAt?: string | null;
    recurrenceRule?: string | null;
    recurrenceEndAt?: string | null;
    priority?: WorkPriority;
    status?: WorkItemStatus;
  }) => apiFetch<{ activity: WorkActivity }>("/work/activities", { method: "POST", body: JSON.stringify(data) }),

  updateWorkActivity: (
    id: string,
    data: Partial<{
      title: string;
      description: string;
      workProjectId: string | null;
      agentId: string | null;
      scheduleType: WorkScheduleType;
      scheduledAt: string | null;
      recurrenceRule: string | null;
      recurrenceEndAt: string | null;
      priority: WorkPriority;
      status: WorkItemStatus;
    }>
  ) => apiFetch<{ updated: boolean }>(`/work/activities/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  deleteWorkActivity: (id: string) =>
    apiFetch<{ deleted: boolean }>(`/work/activities/${id}`, { method: "DELETE" }),

  createWorkTask: (data: {
    title: string;
    description?: string;
    workProjectId?: string | null;
    activityId?: string | null;
    agentId?: string | null;
    scheduleType?: WorkScheduleType;
    scheduledAt?: string | null;
    recurrenceRule?: string | null;
    recurrenceEndAt?: string | null;
    priority?: WorkPriority;
    status?: WorkItemStatus;
  }) => apiFetch<{ task: WorkTask }>("/work/tasks", { method: "POST", body: JSON.stringify(data) }),

  updateWorkTask: (
    id: string,
    data: Partial<{
      title: string;
      description: string;
      workProjectId: string | null;
      activityId: string | null;
      agentId: string | null;
      scheduleType: WorkScheduleType;
      scheduledAt: string | null;
      recurrenceRule: string | null;
      recurrenceEndAt: string | null;
      priority: WorkPriority;
      status: WorkItemStatus;
    }>
  ) => apiFetch<{ updated: boolean }>(`/work/tasks/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  deleteWorkTask: (id: string) =>
    apiFetch<{ deleted: boolean }>(`/work/tasks/${id}`, { method: "DELETE" }),

  linkWorkActivity: (activityId: string, workProjectId: string) =>
    apiFetch<{ linked: boolean }>(`/work/activities/${activityId}/link`, {
      method: "POST",
      body: JSON.stringify({ workProjectId }),
    }),

  unlinkWorkActivity: (activityId: string, workProjectId: string) =>
    apiFetch<{ unlinked: boolean }>(`/work/activities/${activityId}/unlink`, {
      method: "POST",
      body: JSON.stringify({ workProjectId }),
    }),

  duplicateWorkActivity: (
    id: string,
    data?: { workProjectId?: string | null; copyTasks?: boolean }
  ) =>
    apiFetch<{ activity: WorkActivity }>(`/work/activities/${id}/duplicate`, {
      method: "POST",
      body: JSON.stringify(data ?? {}),
    }),

  duplicateWorkTask: (
    id: string,
    data?: { activityId?: string | null; workProjectId?: string | null }
  ) =>
    apiFetch<{ task: WorkTask }>(`/work/tasks/${id}/duplicate`, {
      method: "POST",
      body: JSON.stringify(data ?? {}),
    }),

  getMessages: (slug: string, projectId?: string) =>
    apiFetch<{ messages: ChatMessage[] }>(
      `/chat/${slug}/messages${projectId ? `?projectId=${projectId}` : ""}`
    ),

  sendMessage: (slug: string, message: string, projectId?: string) =>
    apiFetch<{ reply: string; source: string; taskId?: string }>(
      `/chat/${slug}/send`,
      { method: "POST", body: JSON.stringify({ message, projectId }) }
    ),

  getCreativePublishPlatforms: (creativeId: string) =>
    apiFetch<{ platforms: { id: string; label: string }[] }>(
      `/creatives/${creativeId}/publish-platforms`
    ),

  publishCreative: (creativeId: string, platform: string, notes?: string) =>
    apiFetch<{ creative: AgentCreative; message: string }>(`/creatives/${creativeId}/publish`, {
      method: "POST",
      body: JSON.stringify({ platform, notes }),
    }),

  scheduleCreative: (creativeId: string, platform: string, scheduledAt: string, notes?: string) =>
    apiFetch<{ creative: AgentCreative; message: string }>(`/creatives/${creativeId}/schedule`, {
      method: "POST",
      body: JSON.stringify({ platform, scheduledAt, notes }),
    }),

  getSocialPlatforms: () =>
    apiFetch<{
      platforms: { id: string; label: string; integrationSlugs: string[]; workspaceConnected: boolean }[];
      oauthProviders: {
        id: string;
        label: string;
        platforms: string[];
        configured: boolean;
        description: string;
      }[];
    }>("/social/platforms"),

  startSocialOauth: (platform: string) =>
    apiFetch<{ url: string }>(`/social/oauth/${platform}/start`),

  getSocialAccounts: () => apiFetch<{ accounts: SocialAccount[] }>("/social/accounts"),

  createSocialAccount: (data: {
    platform: string;
    handle: string;
    displayName?: string;
    profileUrl?: string;
    integrationSlug?: string;
    config?: Record<string, unknown>;
  }) =>
    apiFetch<{ account: SocialAccount }>("/social/accounts", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateSocialAccount: (id: string, data: Partial<SocialAccountInput>) =>
    apiFetch<{ account: SocialAccount }>(`/social/accounts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteSocialAccount: (id: string) =>
    apiFetch<{ deleted: boolean }>(`/social/accounts/${id}`, { method: "DELETE" }),

  getSocialPosts: (projectId?: string) =>
    apiFetch<{ posts: SocialPost[] }>(
      `/social/posts${projectId ? `?projectId=${projectId}` : ""}`
    ),

  createSocialPost: (data: {
    platform?: string;
    platforms?: string[];
    content: string;
    projectId?: string;
    scheduledAt?: string;
    publishNow?: boolean;
    handle?: string;
    socialAccountId?: string;
    creativeId?: string;
  }) =>
    apiFetch<{
      post: SocialPost;
      message: string;
      results?: { post: SocialPost; message: string }[];
    }>("/social/posts", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  publishSocialPost: (postId: string) =>
    apiFetch<{ post: SocialPost; message: string }>(`/social/posts/${postId}/publish`, {
      method: "POST",
    }),

  scheduleSocialPost: (postId: string, scheduledAt: string) =>
    apiFetch<{ post: SocialPost; message: string }>(`/social/posts/${postId}/schedule`, {
      method: "POST",
      body: JSON.stringify({ scheduledAt }),
    }),

  planSocialContent: (data: {
    brief: string;
    platforms?: string[];
    days?: number;
    postsPerWeek?: number;
    brandVoice?: string;
  }) =>
    apiFetch<{
      plan: {
        theme: string;
        summary: string;
        posts: {
          platform: string;
          content: string;
          scheduledAt: string;
          contentType: string;
          rationale: string;
        }[];
      };
    }>("/social/ai/plan", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  scheduleSocialPlan: (data: {
    posts: { platform: string; content: string; scheduledAt?: string }[];
    projectId?: string;
    publishNow?: boolean;
  }) =>
    apiFetch<{ message: string; results: { post: SocialPost; message: string }[] }>(
      "/social/ai/plan/schedule",
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    ),

  getNetworkCommunities: (params?: { platform?: string; q?: string }) => {
    const qs = new URLSearchParams();
    if (params?.platform) qs.set("platform", params.platform);
    if (params?.q) qs.set("q", params.q);
    const suffix = qs.toString() ? `?${qs}` : "";
    return apiFetch<{ communities: NetworkCommunity[] }>(`/networks/communities${suffix}`);
  },

  getNetworkProfile: (projectId?: string) =>
    apiFetch<{ profile: NetworkGtmProfile | null }>(
      `/networks/profile${projectId ? `?projectId=${projectId}` : ""}`
    ),

  saveNetworkProfile: (data: {
    projectId?: string;
    productName?: string;
    productType?: string;
    industry?: string;
    icp?: string;
    offer?: string;
    stage?: string;
    goals?: string[];
    interests?: string[];
    brandVoice?: string;
    geography?: string;
    notes?: string;
  }) =>
    apiFetch<{ profile: NetworkGtmProfile }>("/networks/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  recommendNetworkCommunities: (data?: {
    projectId?: string;
    limit?: number;
    productName?: string;
    industry?: string;
    icp?: string;
    offer?: string;
    productType?: string;
    stage?: string;
    goals?: string[];
    interests?: string[];
  }) =>
    apiFetch<{ profile: NetworkGtmProfile; recommendations: NetworkCommunity[] }>(
      "/networks/recommend",
      { method: "POST", body: JSON.stringify(data ?? {}) }
    ),

  getNetworkMemberships: () =>
    apiFetch<{ memberships: NetworkMembership[] }>("/networks/memberships"),

  updateNetworkMembership: (data: {
    communityId: string;
    status: string;
    fitScore?: number;
    fitReason?: string;
  }) =>
    apiFetch<{ membership: unknown }>("/networks/memberships", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  generateNetworkCollateral: (projectId?: string) =>
    apiFetch<{ collateral: NetworkCollateralPack; brief: string }>("/networks/collateral", {
      method: "POST",
      body: JSON.stringify({ projectId }),
    }),

  generateNetworkCreatives: (data: {
    mode: "shared" | "individual";
    communityIds: string[];
    projectId?: string;
    collateral?: NetworkCollateralPack;
  }) =>
    apiFetch<{ mode: "shared" | "individual"; creatives: NetworkCreativeItem[] }>(
      "/networks/creatives",
      { method: "POST", body: JSON.stringify(data) }
    ),

  getNetworkCampaigns: () =>
    apiFetch<{ campaigns: NetworkCampaign[] }>("/networks/campaigns"),

  getNetworkCampaign: (id: string) =>
    apiFetch<{ campaign: NetworkCampaign; jobs: NetworkCampaignJob[] }>(
      `/networks/campaigns/${id}`
    ),

  createNetworkCampaign: (data: {
    title: string;
    goal?: string;
    projectId?: string;
    communityIds: string[];
    publishOwnedNow?: boolean;
    collateral?: NetworkCollateralPack;
    creativeMode?: "none" | "shared" | "individual";
    sharedCreativeId?: string | null;
    creatives?: { communityId?: string | null; creativeId: string }[];
  }) =>
    apiFetch<{ campaign: NetworkCampaign; jobs: NetworkCampaignJob[] }>("/networks/campaigns", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateNetworkJobStatus: (
    id: string,
    data: { status?: string; outcome?: string; notes?: string }
  ) =>
    apiFetch<{ job: NetworkCampaignJob }>(`/networks/jobs/${id}/status`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  publishNetworkJob: (id: string) =>
    apiFetch<{ job: NetworkCampaignJob; message: string }>(`/networks/jobs/${id}/publish`, {
      method: "POST",
    }),

  getBrandGuidelines: () => apiFetch<{ brand: BrandGuidelines }>("/brand"),

  saveBrandGuidelines: (data: {
    companyName?: string | null;
    tagline?: string | null;
    logoAltText?: string | null;
    primaryColor?: string | null;
    secondaryColor?: string | null;
    accentColor?: string | null;
    fontPrimary?: string | null;
    fontSecondary?: string | null;
    imageStyle?: string;
    visualKeywords?: string[];
    logoPlacement?: string;
    doNotes?: string | null;
    dontNotes?: string | null;
    extraRules?: string | null;
    clearLogo?: boolean;
  }) =>
    apiFetch<{ brand: BrandGuidelines }>("/brand", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  uploadBrandLogo: (file: File) => {
    const form = new FormData();
    form.append("logo", file);
    return apiFetch<{ brand: BrandGuidelines }>("/brand/logo", {
      method: "POST",
      body: form,
    });
  },

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

  getAiSettings: () => apiFetch<AiSettingsResponse>("/settings/ai"),

  updateAiSettings: (data: UpdateAiSettingsPayload) =>
    apiFetch<AiSettingsResponse>("/settings/ai", { method: "PATCH", body: JSON.stringify(data) }),

  testAiConnection: (data: { provider: string; model?: string; apiKey?: string }) =>
    apiFetch<{ ok: boolean; reply?: string; provider?: string; model?: string; error?: string }>(
      "/settings/ai/test",
      { method: "POST", body: JSON.stringify(data) }
    ),

  discoverAiModels: (data: { provider: string; apiKey?: string }) =>
    apiFetch<{ models: string[]; settings: AiSettingsResponse }>("/settings/ai/discover-models", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
