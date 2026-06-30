-- Social media accounts (user handles) and scheduled/published posts

CREATE TABLE IF NOT EXISTS social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL
    CHECK (platform IN ('instagram', 'facebook', 'linkedin', 'x-twitter', 'tiktok', 'buffer')),
  handle TEXT NOT NULL,
  display_name TEXT,
  profile_url TEXT,
  integration_slug TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, platform, handle)
);

CREATE TABLE IF NOT EXISTS social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  social_account_id UUID REFERENCES social_accounts(id) ON DELETE SET NULL,
  creative_id UUID REFERENCES agent_creatives(id) ON DELETE SET NULL,
  platform TEXT NOT NULL
    CHECK (platform IN ('instagram', 'facebook', 'linkedin', 'x-twitter', 'tiktok', 'buffer')),
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'publishing', 'published', 'failed')),
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  external_post_id TEXT,
  error_detail TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_accounts_user ON social_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_user ON social_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_status_scheduled
  ON social_posts(status, scheduled_at)
  WHERE status = 'scheduled';

CREATE INDEX IF NOT EXISTS idx_agent_creatives_scheduled
  ON agent_creatives(status, scheduled_at)
  WHERE status = 'scheduled';

-- Social Media Manager agent template (marketing team)
INSERT INTO agents (
  slug, name, team, system_prompt, is_active, is_template, template_visibility,
  skills, rules, constraints, avatar_color, chat_mode, team_group_id
)
SELECT
  'social-media-manager',
  'Social Media Manager',
  'marketing',
  'You are the Social Media Manager for this workspace. You plan content calendars, write platform-native copy, schedule and publish posts, and coordinate with Design Agent for visuals. You use connected social accounts and publishing tools configured in the App Store.',
  true,
  true,
  'public',
  '["Social content strategy","Multi-platform scheduling","Community engagement","Analytics reporting","Brand voice consistency","Campaign coordination"]'::jsonb,
  '["Draft platform-specific copy (Instagram, LinkedIn, Facebook, X) aligned with brand voice","Schedule posts at optimal times using schedule_post actions","Publish approved content with publish_post when the user confirms","Connect and reference the user''s configured social handles","Coordinate image creatives with Design Agent when visuals are needed","Track what was scheduled vs published and report status clearly"]'::jsonb,
  '["Confirm publish intent before live posting unless user explicitly says publish now","Respect character limits per platform","Never publish to accounts the user has not configured"]'::jsonb,
  '#ec4899',
  'direct',
  tg.id
FROM team_groups tg
WHERE tg.slug = 'marketing'
  AND NOT EXISTS (SELECT 1 FROM agents WHERE slug = 'social-media-manager');

INSERT INTO schema_migrations (name) VALUES ('022_social_media.sql') ON CONFLICT DO NOTHING;
