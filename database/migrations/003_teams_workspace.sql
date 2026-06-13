-- Teams workspace: groups, agent cloning, project agent groups

CREATE TABLE IF NOT EXISTS schema_migrations (
  name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#6366f1',
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE agents ADD COLUMN IF NOT EXISTS team_group_id UUID REFERENCES team_groups(id) ON DELETE SET NULL;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS parent_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS skills JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS rules JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS constraints JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS avatar_color TEXT DEFAULT '#6366f1';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS is_template BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

CREATE TABLE IF NOT EXISTS project_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'contributor',
  skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  constraints JSONB NOT NULL DEFAULT '[]'::jsonb,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_agents_team_group ON agents(team_group_id);
CREATE INDEX IF NOT EXISTS idx_agents_parent ON agents(parent_agent_id);
CREATE INDEX IF NOT EXISTS idx_project_agents_project ON project_agents(project_id);

INSERT INTO team_groups (name, slug, description, color, icon) VALUES
  ('Design', 'design', 'Visual identity, UI/UX, and creative assets', '#ec4899', '🎨'),
  ('Marketing', 'marketing', 'Campaigns, analytics, and growth', '#f59e0b', '📣'),
  ('Content', 'content', 'Copy, blogs, social, and editorial', '#8b5cf6', '✍️'),
  ('Development', 'development', 'Engineering, code review, and dev ops', '#3b82f6', '💻'),
  ('Sales', 'sales', 'CRM, outreach, and pipeline', '#10b981', '🤝'),
  ('HR', 'hr', 'People ops, policies, and onboarding', '#06b6d4', '👥')
ON CONFLICT (slug) DO NOTHING;

UPDATE agents SET team_group_id = tg.id
FROM team_groups tg
WHERE agents.slug IN ('design', 'marketing', 'content', 'development', 'sales', 'hr', 'dev-agent-chat')
  AND (
    (agents.slug = 'design' AND tg.slug = 'design') OR
    (agents.slug = 'marketing' AND tg.slug = 'marketing') OR
    (agents.slug = 'content' AND tg.slug = 'content') OR
    (agents.slug = 'development' AND tg.slug = 'development') OR
    (agents.slug = 'sales' AND tg.slug = 'sales') OR
    (agents.slug = 'hr' AND tg.slug = 'hr')
  )
  AND agents.team_group_id IS NULL;

UPDATE agents SET team_group_id = (SELECT id FROM team_groups WHERE slug = 'content' LIMIT 1)
WHERE slug = 'content' AND team_group_id IS NULL;

UPDATE agents SET team_group_id = (SELECT id FROM team_groups WHERE slug = 'design' LIMIT 1)
WHERE slug = 'design' AND team_group_id IS NULL;

UPDATE agents SET team_group_id = (SELECT id FROM team_groups WHERE slug = 'marketing' LIMIT 1)
WHERE slug = 'marketing' AND team_group_id IS NULL;

UPDATE agents SET team_group_id = (SELECT id FROM team_groups WHERE slug = 'development' LIMIT 1)
WHERE slug = 'development' AND team_group_id IS NULL;

UPDATE agents SET team_group_id = (SELECT id FROM team_groups WHERE slug = 'sales' LIMIT 1)
WHERE slug = 'sales' AND team_group_id IS NULL;

UPDATE agents SET team_group_id = (SELECT id FROM team_groups WHERE slug = 'hr' LIMIT 1)
WHERE slug = 'hr' AND team_group_id IS NULL;

UPDATE agents SET is_template = true
WHERE parent_agent_id IS NULL AND slug IN ('content', 'design', 'marketing', 'development', 'sales', 'hr');

UPDATE agents SET skills = '["Brand voice","Social copy","Blog drafts","Newsletters"]'::jsonb WHERE slug = 'content' AND skills = '[]'::jsonb;
UPDATE agents SET skills = '["UI/UX briefs","Asset specs","Figma exports","Brand guidelines"]'::jsonb WHERE slug = 'design' AND skills = '[]'::jsonb;
UPDATE agents SET skills = '["Campaign analysis","Ad copy","Analytics reports","SEO"]'::jsonb WHERE slug = 'marketing' AND skills = '[]'::jsonb;
UPDATE agents SET skills = '["Code review","Issue triage","Tech specs","PR summaries"]'::jsonb WHERE slug = 'development' AND skills = '[]'::jsonb;
UPDATE agents SET skills = '["Lead follow-up","CRM updates","Outreach drafts","Pipeline reports"]'::jsonb WHERE slug = 'sales' AND skills = '[]'::jsonb;
UPDATE agents SET skills = '["Policy Q&A","Onboarding","Internal comms","Handbook search"]'::jsonb WHERE slug = 'hr' AND skills = '[]'::jsonb;

UPDATE agents SET rules = '["Draft only — no external publish","Cite knowledge base for brand tone"]'::jsonb WHERE slug = 'content' AND rules = '[]'::jsonb;
UPDATE agents SET constraints = '["Max 500 words per social post","Require human approval before publish"]'::jsonb WHERE slug = 'content' AND constraints = '[]'::jsonb;

INSERT INTO schema_migrations (name) VALUES ('003_teams_workspace.sql') ON CONFLICT DO NOTHING;
