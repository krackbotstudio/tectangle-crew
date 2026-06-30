-- Default workspace and agents to Auto provider/model selection

UPDATE app_settings
SET value = jsonb_set(
  jsonb_set(value, '{defaultProvider}', '"auto"'::jsonb),
  '{defaultModel}', '"auto"'::jsonb
)
WHERE key = 'ai_config'
  AND (value->>'defaultProvider') IS DISTINCT FROM 'auto';

UPDATE app_settings
SET value = value || '{"customProviders": []}'::jsonb
WHERE key = 'ai_config'
  AND value->'customProviders' IS NULL;

UPDATE agents
SET llm_provider = COALESCE(llm_provider, 'auto'),
    llm_model = COALESCE(llm_model, 'auto')
WHERE chat_mode = 'direct'
  AND (llm_provider IS NULL OR llm_model IS NULL);

INSERT INTO schema_migrations (name) VALUES ('013_ai_auto.sql') ON CONFLICT DO NOTHING;
