-- Network campaign jobs: attach generated creatives for owned social / assisted posts

ALTER TABLE network_campaign_jobs
  ADD COLUMN IF NOT EXISTS creative_id UUID REFERENCES agent_creatives(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_network_jobs_creative ON network_campaign_jobs(creative_id);

INSERT INTO schema_migrations (name) VALUES ('025_network_creatives.sql') ON CONFLICT DO NOTHING;
