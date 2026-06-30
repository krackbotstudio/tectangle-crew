-- Generated creatives (images) from design agents + chat message attachments

ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS agent_creatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  message_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  prompt TEXT NOT NULL,
  purpose TEXT,
  width INT,
  height INT,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'image/png',
  provider TEXT,
  status TEXT NOT NULL DEFAULT 'generated'
    CHECK (status IN ('generated', 'scheduled', 'published', 'failed')),
  publish_platform TEXT,
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  publish_notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_creatives_project ON agent_creatives(project_id);
CREATE INDEX IF NOT EXISTS idx_agent_creatives_agent ON agent_creatives(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_creatives_message ON agent_creatives(message_id);

INSERT INTO schema_migrations (name) VALUES ('020_agent_creatives.sql') ON CONFLICT DO NOTHING;
