-- Demo admin user (password: admin123)
INSERT INTO users (email, password_hash, name, role, team)
VALUES (
  'admin@agentdesk.local',
  '$2a$10$8K1p/a0dL1LXMIgoEDFrwOfMQbM.qK8qJ8Y5Y5Y5Y5Y5Y5Y5Y5Y5u',
  'Admin User',
  'admin',
  NULL
) ON CONFLICT (email) DO NOTHING;

-- bcrypt hash for admin123 - will be set by API seed script if missing
-- Placeholder agents
INSERT INTO agents (slug, name, team, webhook_url, chat_webhook_path, system_prompt, knowledge_collection_id, connected_apps, is_active)
VALUES
  (
    'content',
    'Content Agent',
    'Content',
    NULL,
    'content-agent-chat',
    'You are the Content Agent for Agent Desk. You write on-brand copy for blogs, social posts, newsletters, and landing pages. Match the company voice: clear, confident, helpful. Always ask clarifying questions when the brief is vague. Never publish externally — only draft content for human review.',
    'content-kb',
    '["Google Drive", "Google Sheets", "Claude"]'::jsonb,
    false
  ),
  (
    'design',
    'Design Agent',
    'Design',
    NULL,
    'design-agent-chat',
    'You are the Design Agent. You produce creative briefs, layout suggestions, and asset specifications aligned with brand guidelines.',
    'design-kb',
    '["Figma", "Google Drive"]'::jsonb,
    false
  ),
  (
    'development',
    'Development Agent',
    'Development',
    NULL,
    'dev-agent-chat',
    'You are the Development Agent. You help with technical specs, code review summaries, and engineering task breakdowns.',
    'dev-kb',
    '["GitHub", "Slack"]'::jsonb,
    false
  ),
  (
    'marketing',
    'Marketing Agent',
    'Marketing',
    NULL,
    'marketing-agent-chat',
    'You are the Marketing Agent. You analyze campaign performance and draft marketing copy and strategy recommendations.',
    'marketing-kb',
    '["Google Analytics", "Meta Ads", "Google Ads"]'::jsonb,
    false
  ),
  (
    'sales',
    'Sales Agent',
    'Sales',
    NULL,
    'sales-agent-chat',
    'You are the Sales Agent. You draft follow-ups, summarize CRM activity, and help personalize outreach.',
    'sales-kb',
    '["HubSpot", "Gmail", "Calendar"]'::jsonb,
    false
  ),
  (
    'hr',
    'HR Agent',
    'HR',
    NULL,
    'hr-agent-chat',
    'You are the HR Agent. You help with policy questions, onboarding checklists, and internal communications.',
    'hr-kb',
    '["Google Drive", "Calendar", "Email"]'::jsonb,
    false
  ),
  (
    'orchestrator',
    'Orchestrator',
    'Cross-team',
    NULL,
    'orchestrator',
    'You are the Orchestrator. You decompose cross-functional project goals into subtasks for Content, Design, Marketing, Sales, Development, and HR agents.',
    'orchestrator-kb',
    '[]'::jsonb,
    false
  )
ON CONFLICT (slug) DO NOTHING;
