import { query } from "../db.js";
import { getCatalogTool } from "./toolCatalog.js";
import { decryptSecret, encryptSecret, maskSecret } from "./secretCrypto.js";

export type IntegrationConnectionType = "oauth" | "api_key" | "mcp" | "n8n" | "manual";
export type IntegrationStatus = "not_configured" | "configured" | "connected" | "error" | "disabled";
export type McpTransport = "stdio" | "sse" | "http";

export interface IntegrationCredentials {
  apiKey?: string;
  apiSecret?: string;
  anonKey?: string;
  accessToken?: string;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
  webhookSecret?: string;
}

export interface WorkspaceIntegrationRow {
  id: string;
  tool_slug: string;
  tool_name: string;
  category: string;
  connection_type: IntegrationConnectionType;
  status: IntegrationStatus;
  account_label: string | null;
  config: Record<string, unknown>;
  credentials_encrypted: string | null;
  notes: string | null;
  configured_by: string | null;
  last_tested_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMcpRow {
  id: string;
  name: string;
  description: string | null;
  transport: McpTransport;
  server_url: string | null;
  command: string | null;
  args: string[];
  env_keys: string[];
  credentials_encrypted: string | null;
  status: IntegrationStatus;
  notes: string | null;
  configured_by: string | null;
  last_tested_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

function parseCredentials(encrypted: string | null): IntegrationCredentials {
  if (!encrypted) return {};
  try {
    return JSON.parse(decryptSecret(encrypted)) as IntegrationCredentials;
  } catch {
    return {};
  }
}

function maskCredentials(creds: IntegrationCredentials): Record<string, string | null> {
  return {
    apiKey: maskSecret(creds.apiKey),
    apiSecret: maskSecret(creds.apiSecret),
    anonKey: maskSecret(creds.anonKey),
    accessToken: maskSecret(creds.accessToken),
    refreshToken: maskSecret(creds.refreshToken),
    clientId: creds.clientId ? creds.clientId : null,
    clientSecret: maskSecret(creds.clientSecret),
    webhookSecret: maskSecret(creds.webhookSecret),
  };
}

export function mapWorkspaceIntegration(row: WorkspaceIntegrationRow) {
  const catalog = getCatalogTool(row.tool_slug);
  const creds = parseCredentials(row.credentials_encrypted);
  return {
    id: row.id,
    toolSlug: row.tool_slug,
    toolName: row.tool_name,
    category: row.category,
    connectionType: row.connection_type,
    status: row.status,
    accountLabel: row.account_label,
    config: row.config,
    credentials: maskCredentials(creds),
    hasCredentials: Object.values(creds).some((v) => !!v?.trim()),
    notes: row.notes,
    configuredBy: row.configured_by,
    lastTestedAt: row.last_tested_at,
    lastError: row.last_error,
    description: catalog?.description ?? null,
    capabilities: catalog?.capabilities ?? [],
    connectVia: catalog?.connectVia ?? row.connection_type,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapMcpConnector(row: WorkspaceMcpRow) {
  const creds = parseCredentials(row.credentials_encrypted);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    transport: row.transport,
    serverUrl: row.server_url,
    command: row.command,
    args: row.args,
    envKeys: row.env_keys,
    credentials: maskCredentials(creds),
    hasCredentials: Object.values(creds).some((v) => !!v?.trim()),
    status: row.status,
    notes: row.notes,
    configuredBy: row.configured_by,
    lastTestedAt: row.last_tested_at,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listWorkspaceIntegrations() {
  const result = await query<WorkspaceIntegrationRow>(
    `SELECT * FROM workspace_integrations ORDER BY tool_name ASC`
  );
  return result.rows.map(mapWorkspaceIntegration);
}

export async function getWorkspaceIntegrationBySlug(toolSlug: string) {
  const result = await query<WorkspaceIntegrationRow>(
    `SELECT * FROM workspace_integrations WHERE tool_slug = $1`,
    [toolSlug]
  );
  return result.rows[0] ? mapWorkspaceIntegration(result.rows[0]) : null;
}

/** Decrypted credentials + config for server-side integration calls only. */
export async function getWorkspaceIntegrationSecrets(toolSlug: string) {
  const result = await query<WorkspaceIntegrationRow>(
    `SELECT credentials_encrypted, config FROM workspace_integrations WHERE tool_slug = $1`,
    [toolSlug]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    credentials: parseCredentials(row.credentials_encrypted),
    config: row.config ?? {},
  };
}

export async function getWorkspaceIntegrationMap() {
  const rows = await listWorkspaceIntegrations();
  return new Map(rows.map((r) => [r.toolSlug, r]));
}

export interface UpsertIntegrationInput {
  connectionType?: IntegrationConnectionType;
  status?: IntegrationStatus;
  accountLabel?: string | null;
  config?: Record<string, unknown>;
  credentials?: Partial<IntegrationCredentials>;
  notes?: string | null;
  configuredBy?: string;
}

export async function upsertWorkspaceIntegration(
  toolSlug: string,
  input: UpsertIntegrationInput
) {
  const catalog = getCatalogTool(toolSlug);
  if (!catalog) {
    throw new Error("Unknown tool");
  }

  const existing = await query<WorkspaceIntegrationRow>(
    `SELECT * FROM workspace_integrations WHERE tool_slug = $1`,
    [toolSlug]
  );
  const row = existing.rows[0];

  let credentialsEncrypted = row?.credentials_encrypted ?? null;
  if (input.credentials) {
    const current = parseCredentials(credentialsEncrypted);
    const merged = { ...current };
    for (const [key, value] of Object.entries(input.credentials)) {
      const v = typeof value === "string" ? value.trim() : value;
      if (v) {
        (merged as Record<string, string>)[key] = v;
      }
    }
    const hasAny = Object.values(merged).some((v) => !!v?.trim());
    credentialsEncrypted = hasAny ? encryptSecret(JSON.stringify(merged)) : null;
  }

  const connectionType =
    input.connectionType ?? row?.connection_type ?? catalog.connectVia ?? "api_key";
  const status = input.status ?? row?.status ?? "configured";
  const accountLabel =
    input.accountLabel !== undefined ? input.accountLabel : row?.account_label ?? null;
  const config =
    input.config !== undefined ? input.config : row?.config ?? {};
  const notes = input.notes !== undefined ? input.notes : row?.notes ?? null;

  if (row) {
    const result = await query<WorkspaceIntegrationRow>(
      `UPDATE workspace_integrations SET
         connection_type = $2,
         status = $3,
         account_label = $4,
         config = $5::jsonb,
         credentials_encrypted = $6,
         notes = $7,
         configured_by = COALESCE($8, configured_by),
         updated_at = NOW()
       WHERE tool_slug = $1
       RETURNING *`,
      [
        toolSlug,
        connectionType,
        status,
        accountLabel,
        JSON.stringify(config),
        credentialsEncrypted,
        notes,
        input.configuredBy ?? null,
      ]
    );
    return mapWorkspaceIntegration(result.rows[0]);
  }

  const result = await query<WorkspaceIntegrationRow>(
    `INSERT INTO workspace_integrations
       (tool_slug, tool_name, category, connection_type, status, account_label, config, credentials_encrypted, notes, configured_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10)
     RETURNING *`,
    [
      toolSlug,
      catalog.name,
      catalog.category,
      connectionType,
      status,
      accountLabel,
      JSON.stringify(config),
      credentialsEncrypted,
      notes,
      input.configuredBy ?? null,
    ]
  );
  return mapWorkspaceIntegration(result.rows[0]);
}

export async function deleteWorkspaceIntegration(toolSlug: string) {
  const result = await query<{ id: string }>(
    `DELETE FROM workspace_integrations WHERE tool_slug = $1 RETURNING id`,
    [toolSlug]
  );
  return !!result.rows[0];
}

export async function markIntegrationTested(
  toolSlug: string,
  ok: boolean,
  error?: string
) {
  await query(
    `UPDATE workspace_integrations SET
       last_tested_at = NOW(),
       last_error = $2,
       status = CASE WHEN $3 THEN 'connected' ELSE 'error' END,
       updated_at = NOW()
     WHERE tool_slug = $1`,
    [toolSlug, ok ? null : error ?? "Test failed", ok]
  );
}

export async function listMcpConnectors() {
  const result = await query<WorkspaceMcpRow>(
    `SELECT * FROM workspace_mcp_connectors ORDER BY name ASC`
  );
  return result.rows.map(mapMcpConnector);
}

export interface UpsertMcpInput {
  name?: string;
  description?: string | null;
  transport?: McpTransport;
  serverUrl?: string | null;
  command?: string | null;
  args?: string[];
  envKeys?: string[];
  credentials?: Partial<IntegrationCredentials>;
  status?: IntegrationStatus;
  notes?: string | null;
  configuredBy?: string;
}

export async function createMcpConnector(input: UpsertMcpInput & { name: string }) {
  let credentialsEncrypted: string | null = null;
  if (input.credentials) {
    const creds = Object.fromEntries(
      Object.entries(input.credentials).filter(([, v]) => v?.trim())
    ) as IntegrationCredentials;
    if (Object.keys(creds).length > 0) {
      credentialsEncrypted = encryptSecret(JSON.stringify(creds));
    }
  }

  const result = await query<WorkspaceMcpRow>(
    `INSERT INTO workspace_mcp_connectors
       (name, description, transport, server_url, command, args, env_keys, credentials_encrypted, status, notes, configured_by)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, $11)
     RETURNING *`,
    [
      input.name,
      input.description ?? null,
      input.transport ?? "sse",
      input.serverUrl ?? null,
      input.command ?? null,
      JSON.stringify(input.args ?? []),
      JSON.stringify(input.envKeys ?? []),
      credentialsEncrypted,
      input.status ?? "configured",
      input.notes ?? null,
      input.configuredBy ?? null,
    ]
  );
  return mapMcpConnector(result.rows[0]);
}

export async function updateMcpConnector(id: string, input: UpsertMcpInput) {
  const existing = await query<WorkspaceMcpRow>(
    `SELECT * FROM workspace_mcp_connectors WHERE id = $1`,
    [id]
  );
  const row = existing.rows[0];
  if (!row) return null;

  let credentialsEncrypted = row.credentials_encrypted;
  if (input.credentials) {
    const current = parseCredentials(credentialsEncrypted);
    const merged = { ...current };
    for (const [key, value] of Object.entries(input.credentials)) {
      const v = typeof value === "string" ? value.trim() : value;
      if (v) {
        (merged as Record<string, string>)[key] = v;
      }
    }
    const hasAny = Object.values(merged).some((v) => !!v?.trim());
    credentialsEncrypted = hasAny ? encryptSecret(JSON.stringify(merged)) : null;
  }

  const result = await query<WorkspaceMcpRow>(
    `UPDATE workspace_mcp_connectors SET
       name = COALESCE($2, name),
       description = COALESCE($3, description),
       transport = COALESCE($4, transport),
       server_url = COALESCE($5, server_url),
       command = COALESCE($6, command),
       args = COALESCE($7::jsonb, args),
       env_keys = COALESCE($8::jsonb, env_keys),
       credentials_encrypted = $9,
       status = COALESCE($10, status),
       notes = COALESCE($11, notes),
       configured_by = COALESCE($12, configured_by),
       updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      id,
      input.name ?? null,
      input.description !== undefined ? input.description : null,
      input.transport ?? null,
      input.serverUrl !== undefined ? input.serverUrl : null,
      input.command !== undefined ? input.command : null,
      input.args ? JSON.stringify(input.args) : null,
      input.envKeys ? JSON.stringify(input.envKeys) : null,
      credentialsEncrypted,
      input.status ?? null,
      input.notes !== undefined ? input.notes : null,
      input.configuredBy ?? null,
    ]
  );
  return mapMcpConnector(result.rows[0]);
}

export async function deleteMcpConnector(id: string) {
  const result = await query<{ id: string }>(
    `DELETE FROM workspace_mcp_connectors WHERE id = $1 RETURNING id`,
    [id]
  );
  return !!result.rows[0];
}
