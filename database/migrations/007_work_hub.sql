-- Work hub: user-managed projects, activities, and planned tasks

CREATE TABLE IF NOT EXISTS work_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('planning', 'active', 'completed', 'archived')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  start_date DATE,
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_project_id UUID REFERENCES work_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done', 'cancelled', 'scheduled')),
  schedule_type TEXT NOT NULL DEFAULT 'one_time' CHECK (schedule_type IN ('one_time', 'scheduled', 'recurring')),
  scheduled_at TIMESTAMPTZ,
  recurrence_rule TEXT,
  recurrence_end_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS work_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_project_id UUID REFERENCES work_projects(id) ON DELETE CASCADE,
  activity_id UUID REFERENCES activities(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done', 'cancelled', 'scheduled')),
  schedule_type TEXT NOT NULL DEFAULT 'one_time' CHECK (schedule_type IN ('one_time', 'scheduled', 'recurring')),
  scheduled_at TIMESTAMPTZ,
  recurrence_rule TEXT,
  recurrence_end_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activities_work_project ON activities(work_project_id);
CREATE INDEX IF NOT EXISTS idx_activities_agent ON activities(agent_id);
CREATE INDEX IF NOT EXISTS idx_work_tasks_work_project ON work_tasks(work_project_id);
CREATE INDEX IF NOT EXISTS idx_work_tasks_activity ON work_tasks(activity_id);
CREATE INDEX IF NOT EXISTS idx_work_tasks_agent ON work_tasks(agent_id);

INSERT INTO schema_migrations (name) VALUES ('007_work_hub.sql') ON CONFLICT DO NOTHING;
