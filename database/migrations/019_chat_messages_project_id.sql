-- Add project_id to chat_messages to support shared chat feed in project groups
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_chat_messages_project ON chat_messages(project_id);

INSERT INTO schema_migrations (name) VALUES ('019_chat_messages_project_id.sql') ON CONFLICT DO NOTHING;
