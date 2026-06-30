-- User-created agent templates with public/private visibility

ALTER TABLE agents ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS template_visibility TEXT NOT NULL DEFAULT 'public';

UPDATE agents
SET template_visibility = 'public'
WHERE is_template = true AND (template_visibility IS NULL OR template_visibility = '');

CREATE INDEX IF NOT EXISTS idx_agents_template_library
  ON agents (is_template, template_visibility, created_by)
  WHERE is_template = true AND parent_agent_id IS NULL;

INSERT INTO schema_migrations (name) VALUES ('021_agent_template_library.sql') ON CONFLICT DO NOTHING;
