-- Workspace access control for team members

CREATE TABLE IF NOT EXISTS user_team_access (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_group_id UUID NOT NULL REFERENCES team_groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, team_group_id)
);

CREATE TABLE IF NOT EXISTS user_project_access (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, project_id)
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_user_team_access_user ON user_team_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_project_access_user ON user_project_access(user_id);

INSERT INTO schema_migrations (name) VALUES ('005_workspace_access.sql') ON CONFLICT DO NOTHING;
