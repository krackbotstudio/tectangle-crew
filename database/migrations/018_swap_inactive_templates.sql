-- Swap inactive template agents in project_agents with their active clones if they exist
UPDATE project_agents
SET agent_id = (
  SELECT c.id FROM agents c
  WHERE c.parent_agent_id = project_agents.agent_id
    AND c.is_active = true
  LIMIT 1
)
WHERE agent_id IN (
  SELECT t.id FROM agents t
  WHERE t.is_template = true
    AND t.is_active = false
) AND EXISTS (
  SELECT 1 FROM agents c
  WHERE c.parent_agent_id = project_agents.agent_id
    AND c.is_active = true
);

INSERT INTO schema_migrations (name) VALUES ('018_swap_inactive_templates.sql') ON CONFLICT DO NOTHING;
