-- Add Google AI (Gemini) as a built-in provider

UPDATE app_settings
SET value = jsonb_set(
  value,
  '{providers,google}',
  COALESCE(
    value->'providers'->'google',
    '{"enabled": true, "apiKey": null, "defaultModel": "gemini-2.0-flash"}'::jsonb
  ),
  true
)
WHERE key = 'ai_config';

INSERT INTO schema_migrations (name) VALUES ('014_google_ai.sql') ON CONFLICT DO NOTHING;
