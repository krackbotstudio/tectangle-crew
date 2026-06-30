-- In-app AI model configuration and direct LLM chat

ALTER TABLE agents ADD COLUMN IF NOT EXISTS chat_mode TEXT NOT NULL DEFAULT 'direct'
  CHECK (chat_mode IN ('direct', 'n8n'));
ALTER TABLE agents ADD COLUMN IF NOT EXISTS llm_provider TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS llm_model TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS llm_temperature REAL NOT NULL DEFAULT 0.7;

INSERT INTO app_settings (key, value) VALUES
  ('ai_config', '{
    "defaultProvider": "anthropic",
    "defaultModel": "claude-sonnet-4-20250514",
    "providers": {
      "anthropic": {
        "enabled": true,
        "apiKey": null,
        "defaultModel": "claude-sonnet-4-20250514"
      },
      "openai": {
        "enabled": false,
        "apiKey": null,
        "defaultModel": "gpt-4o"
      }
    }
  }'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (name) VALUES ('012_ai_models.sql') ON CONFLICT DO NOTHING;
