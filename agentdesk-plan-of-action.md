# Agent Desk — Full Plan of Action

**Based on:** [agentdesk-prd.md](./agentdesk-prd.md) v0.1  
**Goal:** Build the complete multi-agent business automation platform (frontend + n8n automation layer + shared data layer)  
**Owner:** sanjeev nihal (Tectangle LLP)  
**Status:** Planning → Execution roadmap

---

## 1. Executive Summary

Agent Desk is a unified web application where each business team (Content, Design, Development, Marketing, Sales, HR) interacts with a dedicated AI agent. Automation logic lives in **n8n**; staff use a **React frontend** for chat, task visibility, knowledge management, approvals, and configuration. A **shared data layer** holds tasks, projects, knowledge metadata, and agent config.

This document turns the PRD into a sequenced build plan: decisions to make first, infrastructure to stand up, then five delivery phases from MVP through rules and optimization.

**End state (v1 complete):**
- Six team agents + Orchestrator, all chat-capable and automation-capable
- Live task/progress feed with n8n deep links
- Per-team knowledge base with RAG
- Cross-team projects with grouped subtasks
- Human-in-the-loop approvals for sensitive actions
- Role-based access (admin, team lead, team member)
- Config-driven agent registry (new agents without frontend redeploy)

---

## 2. Recommended Technology Stack

| Layer | Recommendation | Rationale |
|---|---|---|
| **Frontend** | React 18+ (Vite), TypeScript, Tailwind CSS, React Router | Fast dev, type safety, matches PRD SPA requirement |
| **UI components** | shadcn/ui or Radix + custom theme | Accessible, professional admin/chat UI quickly |
| **State / data fetching** | TanStack Query + lightweight context for auth | Polling for task feed; cache chat history |
| **Auth** | Clerk or Auth.js (NextAuth) with email/password + optional Google SSO | v1: simple login; SSO path for later |
| **Shared data — primary DB** | **PostgreSQL** (Supabase or Neon) | Scales beyond Airtable; relational model fits tasks/projects/agents |
| **Vector store (RAG)** | **Pinecone** (managed) or **Supabase pgvector** (single vendor) | Per-team namespaces/collections |
| **File storage** | Supabase Storage or S3-compatible bucket | Uploaded knowledge docs |
| **Automation** | **n8n** (self-hosted on VPS or n8n Cloud) | PRD requirement; native integrations |
| **LLM** | Claude API (Anthropic) via n8n HTTP/Anthropic nodes | PRD specifies Claude |
| **Hosting — frontend** | Vercel or Cloudflare Pages | Static SPA + serverless API routes if needed |
| **Hosting — n8n** | Docker on Hetzner/DigitalOcean or n8n Cloud | Cost vs. ops tradeoff (see §3) |
| **API bridge (optional)** | Thin Node/Express or Supabase Edge Functions | Frontend → DB reads; approval webhooks; config CRUD |

---

## 3. Architecture Decisions (Resolve Open Questions)

These should be locked in **Week 1** before heavy build work.

### 3.1 Data layer: Postgres (recommended)

| Option | Use when |
|---|---|
| **Postgres + pgvector (recommended)** | You want one system for tasks, config, and vectors; plan to grow past one team |
| Airtable | Fastest prototype only; migrate before Phase 3 |

**Decision:** Postgres as source of truth for `Task`, `Project`, `Agent`, `KnowledgeDocument`, `Rule`, `Approval`, `AuditLog`.

### 3.2 Authentication

| v1 | v2 |
|---|---|
| Email/password + roles (`admin`, `team_lead`, `team_member`) | Google/Microsoft SSO |
| Team members scoped to their agent(s); admin sees all | Fine-grained per-team permissions |

### 3.3 Approval policy (default v1)

Always require human approval before:
- Publishing to social/ad platforms
- Sending external emails (non-internal)
- Creating/updating/deleting CRM records
- Any financial or contract-related action
- GitHub merge/deploy to production

Fully automated (no approval):
- Internal drafts saved to Drive/Sheets
- Status logging and internal Slack notifications
- Analytics/report generation

### 3.4 Hosting

| Component | Recommended default |
|---|---|
| n8n | Self-hosted Docker (1 VPS, backups enabled) OR n8n Cloud if ops time is limited |
| Frontend | Vercel |
| Database | Supabase (Postgres + Storage + optional pgvector) |

### 3.5 Integration priority (v1 shortlist)

| Team | Priority integrations |
|---|---|
| **Content** | Google Drive, Google Sheets, Claude |
| **Marketing** | Google Analytics, Meta/Google Ads (read + draft only) |
| **Sales** | HubSpot OR Salesforce (pick one), Gmail |
| **Design** | Google Drive, Figma (read/export) |
| **Development** | GitHub, Slack |
| **HR** | Google Drive/Docs, Calendar |

Defer Buffer/Meta publishing until approval flow is proven on one team.

---

## 4. System Design Detail

### 4.1 Component diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        React Frontend                            │
│  Sidebar │ Chat │ Tasks │ Knowledge │ Settings │ Projects │      │
│          │ Approvals (Phase 4)                                   │
└───────────────┬───────────────────────────────┬─────────────────┘
                │ REST / Supabase client         │ Webhooks
                ▼                                ▼
┌───────────────────────────┐      ┌─────────────────────────────┐
│   Postgres (+ pgvector)    │◄────►│           n8n                │
│   Tasks, Projects, Agents  │      │  Per-agent workflows         │
│   Knowledge metadata       │      │  Status logger (sub-workflow)│
│   Approvals, Audit         │      │  Orchestrator                │
└───────────────────────────┘      │  Claude + app integrations   │
                ▲                  └─────────────────────────────┘
                │ File upload
        ┌───────┴────────┐
        │ Object storage │
        └────────────────┘
```

### 4.2 n8n workflow inventory (final)

| Workflow | Purpose |
|---|---|
| `status-logger` | Sub-workflow: upsert task row (queued → running → done/failed/pending_approval) |
| `content-agent-chat` | Webhook → RAG → Claude → response |
| `content-agent-scheduled` | Cron → generate drafts → save → log |
| `marketing-agent-*` | Same pattern |
| `sales-agent-*` | Same pattern + CRM triggers |
| `design-agent-*` | Same pattern |
| `dev-agent-*` | GitHub/Slack triggers |
| `hr-agent-*` | Same pattern |
| `orchestrator` | Multi-team project decomposition + sub-workflow calls |
| `approval-resume` | Webhook from frontend → resume paused Wait nodes |
| `knowledge-indexer` | Webhook on doc upload → chunk → embed → vector upsert |

### 4.3 Frontend route map

| Route | Description |
|---|---|
| `/` | Dashboard: recent tasks across teams (admin) or user's teams |
| `/agents/:agentId/chat` | Team agent chat |
| `/agents/:agentId/tasks` | Task feed for agent |
| `/agents/:agentId/knowledge` | Upload/list/delete docs |
| `/agents/:agentId/settings` | Webhook ref, prompt ref, apps list (read/edit by role) |
| `/projects` | Cross-team projects list |
| `/projects/:id` | Project detail + grouped subtasks |
| `/approvals` | Pending approval queue |
| `/admin/agents` | Agent registry CRUD (admin) |
| `/login` | Auth |

### 4.4 Database schema (implementation)

```sql
-- Core tables (Postgres)

agents (
  id UUID PK,
  slug TEXT UNIQUE,           -- content, design, dev, marketing, sales, hr, orchestrator
  name TEXT,
  team TEXT,
  webhook_url TEXT,
  system_prompt TEXT,
  knowledge_collection_id TEXT,
  connected_apps JSONB,
  is_active BOOLEAN,
  created_at, updated_at
)

tasks (
  id UUID PK,
  agent_id UUID FK,
  title TEXT,
  status TEXT,                -- queued, running, done, failed, pending_approval
  current_step TEXT,
  execution_id TEXT,          -- n8n execution ID
  output_ref TEXT,
  parent_project_id UUID FK NULL,
  error_detail TEXT,
  created_at, updated_at
)

projects (
  id UUID PK,
  title TEXT,
  goal TEXT,
  status TEXT,
  created_by UUID FK,
  created_at, updated_at
)

knowledge_documents (
  id UUID PK,
  agent_id UUID FK,
  filename TEXT,
  file_type TEXT,
  storage_path TEXT,
  vector_ids JSONB,
  uploaded_by UUID FK,
  uploaded_at
)

approvals (
  id UUID PK,
  task_id UUID FK,
  agent_id UUID FK,
  payload JSONB,              -- draft email, content preview, etc.
  status TEXT,                -- pending, approved, rejected
  decided_by UUID FK NULL,
  decided_at TIMESTAMPTZ,
  resume_webhook_url TEXT     -- n8n wait resume URL
)

rules (
  id UUID PK,
  agent_id UUID FK,
  name TEXT,
  condition_summary TEXT,
  action_summary TEXT,
  n8n_workflow_id TEXT,
  enabled BOOLEAN,
  last_triggered_at
)

audit_logs (
  id UUID PK,
  actor_id UUID,
  action TEXT,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB,
  created_at
)

chat_messages (
  id UUID PK,
  agent_id UUID FK,
  user_id UUID FK,
  role TEXT,                  -- user, assistant
  content TEXT,
  created_at
)
```

---

## 5. Master Timeline Overview

| Phase | Duration (est.) | Outcome |
|---|---|---|
| **Phase 0 — Setup & decisions** | 1–2 weeks | Infra live, repo scaffold, DB schema, n8n instance |
| **Phase 1 — Foundation (MVP)** | 2–3 weeks | Content Agent chat + basic tasks UI |
| **Phase 2 — Automation & visibility** | 2–3 weeks | Scheduling, status logging, knowledge base + RAG |
| **Phase 3 — Expand teams** | 4–6 weeks | All six agents live with core integrations |
| **Phase 4 — Orchestration & approvals** | 3–4 weeks | Cross-team projects + approval flow |
| **Phase 5 — Rules & optimization** | 2–3 weeks | Conditional rules + polish + metrics |

**Total estimate:** ~14–21 weeks for v1 complete (parallel work on frontend and n8n can compress this).

---

## 6. Phase 0 — Project Setup & Infrastructure

**Objective:** Everything needed before feature development.

### 6.1 Tasks

- [ ] **0.1** Create monorepo or two repos: `agentdesk-web` (React), `agentdesk-n8n` (exported workflow JSON + docs)
- [ ] **0.2** Provision Postgres (Supabase project): run schema migrations
- [ ] **0.3** Provision object storage bucket for knowledge documents
- [ ] **0.4** Deploy n8n (Docker Compose template: n8n + Postgres if separate from app DB)
- [ ] **0.5** Store secrets: Anthropic API key, DB credentials, OAuth apps — n8n credential store only for integration keys
- [ ] **0.6** Seed `agents` table with seven rows (6 teams + orchestrator), inactive until workflows ready
- [ ] **0.7** Set up frontend hosting (Vercel) + environment variables
- [ ] **0.8** Set up auth provider; define roles in JWT/metadata
- [ ] **0.9** Document local dev: `.env.example`, README with webhook URL patterns
- [ ] **0.10** Choose and register OAuth apps for Google, GitHub, HubSpot (as needed)

### 6.2 Deliverables

- Running n8n instance with HTTPS webhook base URL
- Empty frontend app with auth shell and sidebar layout
- Database migrated and seeded
- CI: lint + typecheck on frontend PRs

### 6.3 Exit criteria

- Developer can log in to frontend, see agent sidebar (placeholder), hit health-check endpoint
- n8n accessible to admin; test webhook receives payload

---

## 7. Phase 1 — Foundation (MVP)

**PRD reference:** §9 Phase 1 — Chat + tasks views; Content Agent live; webhook → Claude → response.

### 7.1 Frontend tasks

- [ ] **1.1** App shell: sidebar with six team agents + orchestrator entry (config-driven from `agents` table)
- [ ] **1.2** **Chat view:** message list, input, send; loading and error states
- [ ] **1.3** Chat API client: POST to agent `webhook_url` with `{ message, userId, threadId }`
- [ ] **1.4** Persist chat history to `chat_messages` (optional v1: localStorage first, DB in 1.5)
- [ ] **1.5** **Tasks view (static):** table/card list reading from `tasks` table; poll every 10–15s
- [ ] **1.6** Fallback UI when webhook missing or agent inactive
- [ ] **1.7** Basic responsive layout (mobile-friendly sidebar collapse)

### 7.2 n8n tasks

- [ ] **1.8** Build `content-agent-chat` workflow:
  - Webhook trigger (POST)
  - Optional: fetch last N messages for context
  - Claude node with Content Agent system prompt (hardcoded v1)
  - Respond to webhook with `{ reply, taskId? }`
- [ ] **1.9** Build minimal `status-logger` sub-workflow (insert/update `tasks` via Postgres node or HTTP to API)
- [ ] **1.10** Wire chat workflow to log "Running" → "Done" around Claude call

### 7.3 Content Agent system prompt (v1)

- [ ] **1.11** Draft Content Agent prompt: role, brand voice placeholders, output format, safety boundaries
- [ ] **1.12** Store prompt in `agents.system_prompt`; n8n reads via config webhook or env

### 7.4 Deliverables

- End-to-end: user chats with Content Agent and receives Claude response in <10s typical case
- Tasks tab shows at least manual chat runs

### 7.5 Exit criteria

- [ ] 5 test conversations completed successfully
- [ ] Failed webhook shows user-friendly error
- [ ] Task row created for each chat run with execution_id

---

## 8. Phase 2 — Automation & Visibility

**PRD reference:** §9 Phase 2 — Scheduled automation, status logging, vector KB + upload UI.

### 8.1 Status logging (production-grade)

- [ ] **2.1** Finalize `status-logger` sub-workflow: all fields (id, agent, title, status, current_step, execution_id, timestamps)
- [ ] **2.2** Standardize status transitions: `queued` → `running` → `done` | `failed` | `pending_approval`
- [ ] **2.3** Add "View in n8n" link format: `{N8N_BASE_URL}/workflow/{workflowId}/executions/{executionId}`
- [ ] **2.4** Frontend Tasks view: status badges, relative timestamps, step description, n8n link (admin only)

### 8.2 Scheduled automation (Content Agent)

- [ ] **2.5** `content-agent-daily-draft` workflow: Schedule trigger (e.g. 9:00 AM timezone)
- [ ] **2.6** Pull content calendar from Google Sheet (or stub data)
- [ ] **2.7** Claude generates drafts; save to Drive/Sheet
- [ ] **2.8** Log full run to Tasks feed with `output_ref` link

### 8.3 Knowledge base + RAG

- [ ] **2.9** Frontend Knowledge tab: drag-drop upload, file list, delete
- [ ] **2.10** On upload: save to storage; insert `knowledge_documents` row; trigger `knowledge-indexer` n8n webhook
- [ ] **2.11** Indexer workflow: parse PDF/DOCX/MD → chunk → embed (OpenAI embeddings or Voyage) → upsert to vector store per agent collection
- [ ] **2.12** Update `content-agent-chat` to retrieve top-k chunks before Claude call
- [ ] **2.13** Settings tab (read-only v1): show connected apps, prompt excerpt, doc count

### 8.4 Deliverables

- Daily content job visible in Tasks without manual action
- Uploaded brand doc measurably influences chat responses

### 8.5 Exit criteria

- [ ] Scheduled run succeeds 5 consecutive days (or manual cron tests)
- [ ] RAG retrieval logged in n8n execution for debugging
- [ ] Upload → index → query loop < 2 min for typical PDF

---

## 9. Phase 3 — Expand Teams

**PRD reference:** §9 Phase 3 — Marketing, Sales, Design, Dev, HR agents with integrations.

### 9.1 Agent template (repeat per team)

For each new agent, execute this checklist:

1. [ ] Define system prompt + team SOPs in knowledge base  
2. [ ] Clone chat workflow → rename → adjust prompt + integrations  
3. [ ] Clone scheduled workflow (if applicable)  
4. [ ] Add event triggers (CRM, GitHub, etc.)  
5. [ ] Register in `agents` table; activate  
6. [ ] Smoke test chat + one automation run  
7. [ ] Document connected apps and credentials in admin runbook  

### 9.2 Team-specific work

#### Marketing Agent
- [ ] **3.1** Chat + weekly performance summary schedule
- [ ] **3.2** Google Analytics read node; draft insights via Claude
- [ ] **3.3** Optional: ad account read (no auto-spend)

#### Sales Agent
- [ ] **3.4** Chat + CRM connection (HubSpot recommended for SMB speed)
- [ ] **3.5** Trigger: new lead → log task → draft personalized follow-up (internal draft first)
- [ ] **3.6** Trigger: 48h inactivity rule (prep for Phase 5 full rules)

#### Design Agent
- [ ] **3.7** Chat + brief-to-spec output (dimensions, style notes)
- [ ] **3.8** Figma file link / export fetch if API available

#### Development Agent
- [ ] **3.9** Chat + GitHub issue/PR summary workflow
- [ ] **3.10** Trigger: issue labeled `blocked` > 24h → Slack ping workflow

#### HR Agent
- [ ] **3.11** Chat + policy doc RAG (employee handbook)
- [ ] **3.12** Scheduled: onboarding checklist reminder

### 9.3 Frontend enhancements

- [ ] **3.13** Dashboard home: cross-agent recent tasks widget
- [ ] **3.14** Filter tasks by status, date, agent
- [ ] **3.15** Team-scoped views: non-admin users default to their team agent(s)

### 9.4 Deliverables

- All six team agents active with chat + at least one scheduled or triggered workflow each
- Dashboard gives managers a single-pane view

### 9.5 Exit criteria

- [ ] Each agent has ≥1 successful automated run logged
- [ ] Each agent has ≥3 knowledge documents indexed
- [ ] Role-based routing verified (Sales user cannot edit Content settings)

---

## 10. Phase 4 — Cross-Team Orchestration & Approvals

**PRD reference:** §9 Phase 4 — Orchestrator, Projects view, Approvals.

### 10.1 Orchestrator workflow

- [ ] **4.1** Define orchestrator input schema: `{ goal, teams[], deadline?, context? }`
- [ ] **4.2** Claude planning step: decompose goal into subtasks with assigned agent slugs
- [ ] **4.3** Create parent `projects` row + child `tasks` with `parent_project_id`
- [ ] **4.4** Execute sub-workflows via n8n Execute Workflow node (parallel where safe)
- [ ] **4.5** Aggregate outputs; update project status; notify user (in-app + optional email/Slack)

### 10.2 Projects UI

- [ ] **4.6** `/projects` list: title, status, progress (subtasks done/total)
- [ ] **4.7** `/projects/:id` detail: goal, timeline, nested task list by agent
- [ ] **4.8** Submit new project form → orchestrator webhook

### 10.3 Human-in-the-loop approvals

- [ ] **4.9** n8n pattern: before sensitive action → update task to `pending_approval` → Wait node (webhook resume)
- [ ] **4.10** Insert `approvals` row with payload preview + `resume_webhook_url`
- [ ] **4.11** Frontend `/approvals`: list pending items with Approve/Reject
- [ ] **4.12** On decision: POST to resume URL; update approval + task status; write `audit_logs`
- [ ] **4.13** Apply approval gates to: Content publish workflow, Sales external email send

### 10.4 Deliverables

- One full cross-team project executed (e.g. "Launch campaign for new product")
- At least one approval flow completed end-to-end

### 10.5 Exit criteria

- [ ] Orchestrator project with 3+ subtasks completes with all tasks linked in UI
- [ ] Rejected approval stops external action and logs reason
- [ ] Approved approval completes workflow and marks task Done

---

## 11. Phase 5 — Rules & Optimization

**PRD reference:** §9 Phase 5 — Conditional rules, simple rule UI, prompt/KB refinement.

### 11.1 Rules in n8n (v1 admin-configured)

- [ ] **5.1** Document rule patterns: IF/Switch on metrics → trigger agent sub-workflow
- [ ] **5.2** Implement reference rules:
  - Content: engagement drop >10% → propose new angles
  - Sales: 48h lead inactivity → draft follow-up
  - Dev: blocked ticket >24h → ping assignee
- [ ] **5.3** Each rule logs to `tasks` + updates `rules.last_triggered_at`

### 11.2 Rule configuration UI (lightweight v2 within Phase 5)

- [ ] **5.4** Settings → Rules tab: list rules from DB (synced manually or via n8n metadata)
- [ ] **5.5** Toggle `enabled` flag that n8n reads from Postgres at runtime
- [ ] **5.6** (Optional) Simple form: threshold values stored in JSONB, n8n polls or receives webhook

### 11.3 Optimization & metrics

- [ ] **5.7** Prompt iteration log: version prompts in `agents.system_prompt` with dated comments
- [ ] **5.8** Add feedback thumbs up/down on chat messages → store for review
- [ ] **5.9** Weekly report workflow: tasks completed, failure rate, avg response time
- [ ] **5.10** Success metrics dashboard (PRD §11): hours saved estimate, approval rate, cross-team project count

### 11.4 Hardening

- [ ] **5.11** Error alerting: n8n Error Trigger → Slack/email for failed workflows
- [ ] **5.12** Retry policies on transient Claude/API failures
- [ ] **5.13** Rate limiting on chat webhooks
- [ ] **5.14** Security review: no secrets in frontend, RBAC audit, webhook authentication (shared secret header)

### 11.5 Exit criteria (v1 complete)

- [ ] All PRD §5 core features implemented
- [ ] All PRD §9 phases delivered
- [ ] Success metrics baseline captured for month 1

---

## 12. Frontend Build Specification

### 12.1 Core components to build

| Component | Notes |
|---|---|
| `AppLayout` | Sidebar + header + outlet |
| `AgentSidebar` | Loads agents from API; icons per team |
| `ChatPanel` | Messages, markdown render, code blocks |
| `TaskFeed` | Real-time-ish poll, filters, status chips |
| `KnowledgeManager` | Upload zone, table, delete confirm |
| `AgentSettings` | Prompt editor (role-gated), webhook test button |
| `ProjectList` / `ProjectDetail` | Phase 4 |
| `ApprovalQueue` | Phase 4 |
| `AdminAgentRegistry` | CRUD agents |

### 12.2 UX principles

- Chat is default landing per agent (lowest friction)
- Tasks feed answers "what ran overnight?"
- Every automated run has a human-readable title (not raw workflow name)
- Admins get n8n deep links; team members do not
- Destructive actions require confirmation

### 12.3 Config-driven agents

Frontend loads agent list from DB at startup. Adding agent #7 in future = DB row + n8n workflow only.

---

## 13. n8n Build Specification

### 13.1 Conventions

- Naming: `{team-slug}-{capability}` (e.g. `content-agent-chat`)
- All long-running flows call `status-logger` at start, progress updates, and end
- Shared credentials per integration (one Google OAuth for all teams where possible)
- Environment variables in n8n: `APP_DATABASE_URL`, `ANTHROPIC_*`, `N8N_WEBHOOK_BASE`, `VECTOR_*`

### 13.2 Webhook security

- Require header `X-AgentDesk-Secret: {shared secret}` on all public webhooks
- Frontend obtains short-lived token from backend if needed; never embed n8n secret in client bundle (proxy via Edge Function)

### 13.3 Export & version control

- Export workflow JSON after each phase to `agentdesk-n8n/workflows/`
- CHANGELOG per workflow with date and author

---

## 14. Testing Strategy

| Layer | Approach |
|---|---|
| **Frontend** | Vitest + React Testing Library for components; Playwright for chat → task smoke |
| **n8n** | Manual test executions + pinned test webhook payloads in repo |
| **Integration** | Staging n8n + staging DB; run full user flows from PRD §6 |
| **Load** | Simulate 10 concurrent chat requests; verify <10s p95 |

### Critical test scenarios (from PRD user flows)

1. Ad-hoc chat request with revision follow-up  
2. Scheduled daily automation visible in Tasks  
3. Cross-team orchestrator project  
4. Rule-triggered action with approve and reject paths  
5. Knowledge upload changes agent behavior  

---

## 15. Deployment & Operations

### 15.1 Environments

| Env | Purpose |
|---|---|
| `development` | Local frontend + n8n tunnel (ngrok/cloudflare) |
| `staging` | Full stack; test integrations with sandbox CRM/analytics |
| `production` | Live agents |

### 15.2 Runbooks

- [ ] n8n backup procedure (workflows + credentials export)
- [ ] Database backup (daily automated)
- [ ] Rotate API keys quarterly
- [ ] On-call: who gets Slack alert on workflow failure

### 15.3 Monitoring

- n8n execution history retention policy
- Frontend error tracking (Sentry)
- Uptime check on n8n webhook health endpoint

---

## 16. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| n8n webhook downtime | Chat/automation unavailable | Health checks; queue retries; status banner in UI |
| Claude latency/cost | Slow chat, high bills | Token limits, caching, smaller model for summaries |
| RAG quality poor | Wrong agent answers | Chunk tuning, metadata filters, human feedback loop |
| Integration OAuth expiry | Silent workflow failures | Credential expiry alerts in n8n |
| Scope creep (6 agents at once) | Delayed MVP | Strict Phase 1–2 before parallelizing agents in Phase 3 |
| Approval bypass bug | Reputational/legal risk | Code review on resume webhooks; audit log every decision |

---

## 17. Team & Responsibilities (suggested)

| Role | Owns |
|---|---|
| **Product / Owner** | Priorities, approval policy, prompt quality sign-off |
| **Frontend dev** | React app, auth, all views |
| **Automation dev** | n8n workflows, integrations, status logger |
| **Admin / DevOps** | Hosting, secrets, backups, OAuth app registration |

One person can wear multiple hats early; split as Phase 3 starts.

---

## 18. Definition of Done — Full Application

The application is **complete for v1** when:

- [ ] All six team agents + Orchestrator are registered and active
- [ ] Chat works for every agent with RAG from team knowledge base
- [ ] Tasks feed shows scheduled, triggered, and manual runs with accurate status
- [ ] At least one cross-team project completes via Orchestrator with UI visibility
- [ ] Approval flow blocks and resumes external actions correctly
- [ ] Role-based access enforced (admin, team lead, team member)
- [ ] Credentials never exposed to frontend
- [ ] PRD non-functional requirements met (security, audit, performance target, extensibility)
- [ ] Documentation: user guide for staff, admin runbook for n8n/agents

---

## 19. Immediate Next Steps (Start Here)

**This week:**

1. Confirm stack decisions in §3 (Postgres, auth provider, n8n hosting)
2. Execute Phase 0 tasks 0.1–0.6
3. Draft Content Agent system prompt and 3 sample knowledge docs
4. Build Phase 1 chat loop for Content Agent only
5. Schedule Phase 2 planning once first chat demo works

**Order of build:** Infrastructure → Content Agent (chat) → Tasks/logging → Knowledge/RAG → Remaining agents → Orchestrator → Approvals → Rules

---

## 20. Appendix — Agent Registry (Seed Data)

| slug | name | team | Phase |
|---|---|---|---|
| `content` | Content Agent | Content | 1 |
| `marketing` | Marketing Agent | Marketing | 3 |
| `sales` | Sales Agent | Sales | 3 |
| `design` | Design Agent | Design | 3 |
| `development` | Development Agent | Development | 3 |
| `hr` | HR Agent | HR | 3 |
| `orchestrator` | Orchestrator | Cross-team | 4 |

---

*This plan is a living document. Update checkboxes and dates as work progresses.*
