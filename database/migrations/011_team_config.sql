-- Team-level rules, constraints, and project tool requests

ALTER TABLE team_groups ADD COLUMN IF NOT EXISTS rules JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE team_groups ADD COLUMN IF NOT EXISTS constraints JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS team_tool_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_group_id UUID NOT NULL REFERENCES team_groups(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  tool_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  reason TEXT,
  url TEXT,
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'approved', 'rejected', 'provisioned')),
  requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_tool_requests_team ON team_tool_requests(team_group_id);
CREATE INDEX IF NOT EXISTS idx_team_tool_requests_project ON team_tool_requests(project_id);

INSERT INTO schema_migrations (name) VALUES ('011_team_config.sql') ON CONFLICT DO NOTHING;
