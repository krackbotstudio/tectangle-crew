-- Project-level tool access for agent groups working together

CREATE TABLE IF NOT EXISTS project_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tool_slug TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'requested', 'approved', 'connected', 'disabled')),
  notes TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  added_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, tool_slug)
);

CREATE INDEX IF NOT EXISTS idx_project_tools_project ON project_tools(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tools_status ON project_tools(status);

INSERT INTO schema_migrations (name) VALUES ('016_project_tools.sql') ON CONFLICT DO NOTHING;
