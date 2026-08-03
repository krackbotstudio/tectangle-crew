-- Network Creation Engine: communities, GTM profiles, campaigns, distribution jobs

CREATE TABLE IF NOT EXISTS network_communities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  platform TEXT NOT NULL
    CHECK (platform IN (
      'reddit', 'discord', 'linkedin', 'facebook', 'instagram', 'slack', 'indiehackers',
      'producthunt', 'x-twitter', 'telegram', 'forum', 'other'
    )),
  url TEXT NOT NULL,
  description TEXT,
  industries TEXT[] NOT NULL DEFAULT '{}',
  interests TEXT[] NOT NULL DEFAULT '{}',
  product_types TEXT[] NOT NULL DEFAULT '{}',
  audience_size TEXT,
  activity_level TEXT,
  join_type TEXT NOT NULL DEFAULT 'assisted'
    CHECK (join_type IN ('assisted', 'owned_social', 'integrated')),
  owned_social_platform TEXT,
  rules_notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS network_gtm_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  product_name TEXT,
  product_type TEXT,
  industry TEXT,
  icp TEXT,
  offer TEXT,
  stage TEXT DEFAULT 'launch'
    CHECK (stage IN ('idea', 'mvp', 'launch', 'growth', 'first_customers')),
  goals TEXT[] NOT NULL DEFAULT '{}',
  interests TEXT[] NOT NULL DEFAULT '{}',
  brand_voice TEXT,
  geography TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_network_gtm_user ON network_gtm_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_network_gtm_project ON network_gtm_profiles(project_id);

CREATE TABLE IF NOT EXISTS network_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  community_id UUID NOT NULL REFERENCES network_communities(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'suggested'
    CHECK (status IN ('suggested', 'joined', 'skipped', 'banned')),
  fit_score INT,
  fit_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, community_id)
);

CREATE TABLE IF NOT EXISTS network_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  gtm_profile_id UUID REFERENCES network_gtm_profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  goal TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'ready', 'running', 'completed', 'archived')),
  brief TEXT,
  collateral JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS network_campaign_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES network_campaigns(id) ON DELETE CASCADE,
  community_id UUID REFERENCES network_communities(id) ON DELETE SET NULL,
  channel_type TEXT NOT NULL
    CHECK (channel_type IN ('owned_social', 'assisted_community', 'integrated')),
  platform TEXT NOT NULL,
  destination_label TEXT,
  destination_url TEXT,
  content TEXT NOT NULL,
  collateral_type TEXT NOT NULL DEFAULT 'post'
    CHECK (collateral_type IN ('post', 'dm', 'comment', 'launch', 'waitlist')),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'ready', 'published', 'assisted_pending', 'done', 'failed', 'skipped')),
  social_post_id UUID REFERENCES social_posts(id) ON DELETE SET NULL,
  external_ref TEXT,
  error_detail TEXT,
  outcome TEXT
    CHECK (outcome IS NULL OR outcome IN ('none', 'reply', 'lead', 'customer', 'posted_manually')),
  published_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_network_campaigns_user ON network_campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_network_jobs_campaign ON network_campaign_jobs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_network_memberships_user ON network_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_network_communities_platform ON network_communities(platform);

-- Seed curated communities (idempotent by slug)
INSERT INTO network_communities (slug, name, platform, url, description, industries, interests, product_types, audience_size, activity_level, join_type, owned_social_platform, rules_notes)
VALUES
  ('reddit-saas', 'r/SaaS', 'reddit', 'https://www.reddit.com/r/SaaS/', 'SaaS founders and operators discussing growth, pricing, and launches.', ARRAY['saas','software'], ARRAY['founders','b2b','growth'], ARRAY['saas','b2b'], '500k+', 'high', 'assisted', NULL, 'Read rules; no blatant spam. Prefer value-first launch posts.'),
  ('reddit-startups', 'r/startups', 'reddit', 'https://www.reddit.com/r/startups/', 'Startup founders sharing journey, fundraising, and GTM.', ARRAY['startups','tech'], ARRAY['founders','launch'], ARRAY['saas','marketplace','consumer'], '1M+', 'high', 'assisted', NULL, 'Show traction; avoid pure promo.'),
  ('reddit-entrepreneur', 'r/Entrepreneur', 'reddit', 'https://www.reddit.com/r/Entrepreneur/', 'Broad entrepreneurship community.', ARRAY['business'], ARRAY['founders','sideproject'], ARRAY['saas','agency','ecommerce'], '2M+', 'high', 'assisted', NULL, 'Story + lesson format works best.'),
  ('reddit-smallbusiness', 'r/smallbusiness', 'reddit', 'https://www.reddit.com/r/smallbusiness/', 'Owners of small businesses seeking tools and advice.', ARRAY['smb','services'], ARRAY['owners','operations'], ARRAY['saas','services'], '1M+', 'medium', 'assisted', NULL, 'Helpful advice over hard sell.'),
  ('indiehackers', 'Indie Hackers', 'indiehackers', 'https://www.indiehackers.com/', 'Bootstrapped builders sharing revenue and product updates.', ARRAY['saas','software'], ARRAY['indie','bootstrapped','makers'], ARRAY['saas','tools'], '100k+', 'high', 'assisted', NULL, 'Transparency and milestones resonate.'),
  ('producthunt', 'Product Hunt', 'producthunt', 'https://www.producthunt.com/', 'Launch platform for new products and makers.', ARRAY['tech','saas'], ARRAY['launch','makers'], ARRAY['saas','apps','ai'], 'global', 'high', 'assisted', NULL, 'Coordinate a real launch day with visuals.'),
  ('linkedin-feed', 'LinkedIn (your profile/page)', 'linkedin', 'https://www.linkedin.com/', 'Publish to your connected LinkedIn account.', ARRAY['b2b','saas','professional'], ARRAY['b2b','thought-leadership'], ARRAY['saas','b2b','services'], 'n/a', 'high', 'owned_social', 'linkedin', 'Requires LinkedIn OAuth in Social → Connect.'),
  ('x-feed', 'X / Twitter (your account)', 'x-twitter', 'https://x.com/', 'Publish to your connected X account.', ARRAY['tech','saas','media'], ARRAY['launch','builders'], ARRAY['saas','apps','ai'], 'n/a', 'high', 'owned_social', 'x-twitter', 'Requires X OAuth in Social → Connect.'),
  ('facebook-page', 'Facebook Page', 'facebook', 'https://www.facebook.com/', 'Publish to your connected Facebook Page.', ARRAY['smb','consumer','local'], ARRAY['community','local'], ARRAY['consumer','local','ecommerce'], 'n/a', 'medium', 'owned_social', 'facebook', 'Requires Meta OAuth in Social → Connect.'),
  ('instagram-feed', 'Instagram Feed', 'instagram', 'https://www.instagram.com/', 'Publish to your connected Instagram Business account.', ARRAY['consumer','brand','ecommerce'], ARRAY['visual','brand'], ARRAY['consumer','ecommerce','apps'], 'n/a', 'high', 'owned_social', 'instagram', 'Requires image creative + Meta OAuth.'),
  ('discord-indie', 'Indie hacker Discords (directory)', 'discord', 'https://discord.com/', 'Builder Discords for feedback and early adopters.', ARRAY['saas','software'], ARRAY['makers','feedback'], ARRAY['saas','tools'], 'varies', 'medium', 'assisted', NULL, 'Join relevant servers; respect each server rules.'),
  ('linkedin-groups-saas', 'LinkedIn SaaS / Founder groups', 'linkedin', 'https://www.linkedin.com/groups/', 'Professional groups for SaaS and founders.', ARRAY['saas','b2b'], ARRAY['founders','b2b'], ARRAY['saas','b2b'], 'varies', 'medium', 'assisted', NULL, 'Contribute before promoting.'),
  ('facebook-groups-smb', 'Facebook SMB groups', 'facebook', 'https://www.facebook.com/groups/', 'Local and niche SMB owner groups.', ARRAY['smb','local'], ARRAY['owners','local'], ARRAY['services','local','saas'], 'varies', 'medium', 'assisted', NULL, 'Group rules vary; value-first posts.'),
  ('ph-upcoming', 'Product Hunt Upcoming', 'producthunt', 'https://www.producthunt.com/upcoming', 'Build waitlist before launch day.', ARRAY['tech','saas'], ARRAY['waitlist','launch'], ARRAY['saas','apps','ai'], 'global', 'medium', 'assisted', NULL, 'Collect hunters and supporters early.'),
  ('reddit-marketing', 'r/marketing', 'reddit', 'https://www.reddit.com/r/marketing/', 'Marketers discussing channels and campaigns.', ARRAY['marketing','agency'], ARRAY['marketing','growth'], ARRAY['saas','agency','services'], '500k+', 'medium', 'assisted', NULL, 'Share tactics, not only product plugs.'),
  ('reddit-ai', 'r/artificial / AI builder spaces', 'reddit', 'https://www.reddit.com/r/artificial/', 'AI product discussions and tool launches.', ARRAY['ai','tech'], ARRAY['ai','builders'], ARRAY['ai','saas','apps'], '500k+', 'high', 'assisted', NULL, 'Be clear about what the product does.')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO schema_migrations (name) VALUES ('024_network_engine.sql') ON CONFLICT DO NOTHING;
