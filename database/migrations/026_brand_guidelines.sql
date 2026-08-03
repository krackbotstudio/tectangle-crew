-- Workspace brand guidelines for consistent creatives / GTM imagery

CREATE TABLE IF NOT EXISTS brand_guidelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT,
  tagline TEXT,
  logo_file_name TEXT,
  logo_alt_text TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  accent_color TEXT,
  font_primary TEXT,
  font_secondary TEXT,
  image_style TEXT NOT NULL DEFAULT 'photorealistic'
    CHECK (image_style IN (
      'photorealistic', 'cinematic', 'illustration', 'flat', '3d', 'minimal', 'product_shot'
    )),
  visual_keywords TEXT[] NOT NULL DEFAULT '{}',
  logo_placement TEXT NOT NULL DEFAULT 'subtle_corner'
    CHECK (logo_placement IN (
      'none', 'subtle_corner', 'top_center', 'bottom_center', 'prominent'
    )),
  do_notes TEXT,
  dont_notes TEXT,
  extra_rules TEXT,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Singleton seed row so GET always has a record to edit
INSERT INTO brand_guidelines (company_name)
SELECT NULL
WHERE NOT EXISTS (SELECT 1 FROM brand_guidelines LIMIT 1);

INSERT INTO schema_migrations (name) VALUES ('026_brand_guidelines.sql') ON CONFLICT DO NOTHING;
