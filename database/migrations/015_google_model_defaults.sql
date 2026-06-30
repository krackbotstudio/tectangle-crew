-- Normalize deprecated Google default models in stored ai_config

UPDATE app_settings
SET value = jsonb_set(
  value,
  '{providers,google,defaultModel}',
  '"gemini-2.0-flash-lite"'::jsonb,
  false
)
WHERE key = 'ai_config'
  AND value->'providers'->'google'->>'defaultModel' IN (
    'gemini-1.5-flash-8b',
    'models/gemini-1.5-flash-8b'
  );

INSERT INTO schema_migrations (name) VALUES ('015_google_model_defaults.sql') ON CONFLICT DO NOTHING;
