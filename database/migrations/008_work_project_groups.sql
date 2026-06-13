-- Link work hub projects to agent collaboration groups (projects table)

ALTER TABLE work_projects ADD COLUMN IF NOT EXISTS project_group_id UUID REFERENCES projects(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_work_projects_project_group
  ON work_projects(project_group_id)
  WHERE project_group_id IS NOT NULL;

INSERT INTO schema_migrations (name) VALUES ('008_work_project_groups.sql') ON CONFLICT DO NOTHING;
