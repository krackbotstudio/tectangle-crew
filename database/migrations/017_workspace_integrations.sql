-- Company/workspace-level integrations configured in Console

CREATE TABLE IF NOT EXISTS workspace_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_slug TEXT NOT NULL UNIQUE,
  tool_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  connection_type TEXT NOT NULL DEFAULT 'api_key'
    CHECK (connection_type IN ('oauth', 'api_key', 'mcp', 'n8n', 'manual')),
  status TEXT NOT NULL DEFAULT 'not_configured'
    CHECK (status IN ('not_configured', 'configured', 'connected', 'error', 'disabled')),
  account_label TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  credentials_encrypted TEXT,
  notes TEXT,
  configured_by UUID REFERENCES users(id) ON DELETE SET NULL,
  last_tested_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspace_integrations_status ON workspace_integrations(status);
CREATE INDEX IF NOT EXISTS idx_workspace_integrations_slug ON workspace_integrations(tool_slug);

-- Custom MCP server connectors (beyond catalog apps)
CREATE TABLE IF NOT EXISTS workspace_mcp_connectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  transport TEXT NOT NULL DEFAULT 'sse'
    CHECK (transport IN ('stdio', 'sse', 'http')),
  server_url TEXT,
  command TEXT,
  args JSONB NOT NULL DEFAULT '[]'::jsonb,
  env_keys JSONB NOT NULL DEFAULT '[]'::jsonb,
  credentials_encrypted TEXT,
  status TEXT NOT NULL DEFAULT 'not_configured'
    CHECK (status IN ('not_configured', 'configured', 'connected', 'error', 'disabled')),
  notes TEXT,
  configured_by UUID REFERENCES users(id) ON DELETE SET NULL,
  last_tested_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspace_mcp_status ON workspace_mcp_connectors(status);

INSERT INTO schema_migrations (name) VALUES ('017_workspace_integrations.sql') ON CONFLICT DO NOTHING;
