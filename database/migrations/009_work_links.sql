-- Cross-project activity links and reuse tracking

CREATE TABLE IF NOT EXISTS work_project_activities (
  work_project_id UUID NOT NULL REFERENCES work_projects(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (work_project_id, activity_id)
);

ALTER TABLE activities ADD COLUMN IF NOT EXISTS source_activity_id UUID REFERENCES activities(id) ON DELETE SET NULL;
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS source_task_id UUID REFERENCES work_tasks(id) ON DELETE SET NULL;

INSERT INTO work_project_activities (work_project_id, activity_id)
SELECT work_project_id, id
FROM activities
WHERE work_project_id IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_work_project_activities_project ON work_project_activities(work_project_id);
CREATE INDEX IF NOT EXISTS idx_work_project_activities_activity ON work_project_activities(activity_id);
CREATE INDEX IF NOT EXISTS idx_activities_source ON activities(source_activity_id);
CREATE INDEX IF NOT EXISTS idx_work_tasks_source ON work_tasks(source_task_id);

INSERT INTO schema_migrations (name) VALUES ('009_work_links.sql') ON CONFLICT DO NOTHING;
