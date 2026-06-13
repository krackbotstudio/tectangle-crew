# Product Requirements Document
## Agent Desk — Multi-Agent Business Automation Platform

**Version:** 0.1 (Draft)
**Owner:** sanjeev nihal (Tectangle LLP)
**Status:** Planning

---

## 1. Overview

Agent Desk is an internal platform that lets a business run AI agents for each functional team — Content, Design, Development, Marketing, Sales, and HR — from a single web application. Each agent can work independently (handling team-specific tasks) or collaboratively (handing off work across teams for cross-functional projects).

The platform consists of two layers:
- **Automation layer (n8n):** hosts each agent's logic, scheduled jobs, app/API integrations, and rules.
- **Frontend (web app):** the unified interface where staff chat with agents, monitor task progress, manage knowledge bases, configure rules, and link out to the underlying automation for debugging.

---

## 2. Goals

- Give every team a dedicated AI agent that understands their role, brand/voice, and processes.
- Allow agents to run on-demand (chat) and on autopilot (scheduled/triggered).
- Let agents work across team boundaries on shared projects via an orchestrator.
- Provide visibility into what agents are doing, in progress, and have completed.
- Allow non-technical staff to adjust agent behavior (prompts, knowledge, rules) without writing code.
- Build using no-code/low-code tooling (n8n) for automation logic, paired with a custom (AI-generated) frontend.

### Non-Goals (v1)
- Fully autonomous agents acting without any human review on irreversible/external actions (publishing, sending money, contracts).
- Building a custom LLM or fine-tuning models.
- Mobile app (web-responsive only for v1).

---

## 3. Target Users

| Role | Needs |
|---|---|
| Team members (Content, Design, Dev, Marketing, Sales, HR) | Chat with their team's agent, request work, review outputs |
| Team leads / managers | Monitor task progress, approve outputs, adjust rules and knowledge base |
| Admin / Owner | Configure agents, manage integrations, view all teams, access n8n directly |

---

## 4. System Architecture

```
┌─────────────────────────┐        ┌──────────────────────────────┐
│        Frontend          │ HTTP   │             n8n                │
│  (Chat, Tasks, Settings,  │◄──────►│  - Agent workflows (per team)  │
│   Knowledge Base, Rules)  │webhook │  - Scheduled/triggered jobs    │
│                            │        │  - Claude API calls            │
│                            │        │  - App/API integrations        │
└─────────────────────────┘        │  - Orchestrator workflow        │
                                     │  - Status-logging sub-workflow  │
                                     └──────────┬───────────────────┘
                                                 │
                                     ┌──────────▼───────────────────┐
                                     │  Shared Data Layer              │
                                     │  - Tasks/status table            │
                                     │  - Knowledge base (vector store) │
                                     │  - Project/config store          │
                                     └──────────────────────────────┘
```

### 4.1 Frontend
- Single-page web app (React)
- Sidebar: one entry per team agent (Content, Design, Development, Marketing, Sales, HR)
- Per-agent views: **Chat**, **Tasks** (progress/status feed), **Knowledge Base**, **Settings**
- Calls n8n via webhooks for chat; reads shared data store for task status

### 4.2 Automation Layer (n8n)
- One workflow (or workflow group) per agent, each with:
  - Webhook trigger (chat from frontend)
  - Schedule trigger (daily/recurring jobs)
  - App-event triggers (e.g., new row in sheet, new email, new CRM record)
  - Claude API node with agent-specific system prompt + retrieved knowledge base context
  - Integration nodes (per team's connected apps)
  - Status-logging calls (start, in-progress, done/failed)
- **Orchestrator workflow**: receives multi-team project requests, delegates subtasks to relevant agent workflows (as sub-workflows), aggregates and logs results

### 4.3 Shared Data Layer
- **Tasks/status table** (Airtable / Google Sheets / Postgres): task ID, agent, title, status, current step, timestamps, execution ID, links to outputs
- **Knowledge base** (vector store, e.g., Pinecone/Chroma, or simple document store for v1): brand guidelines, SOPs, templates, past examples — segmented per team
- **Project/config store**: agent rules/thresholds, system prompt versions, integration credentials (managed in n8n credential store)

---

## 5. Core Features

### 5.1 Team Agent Chat
- Each agent has its own chat thread
- Agent responds using its system prompt + relevant knowledge base context (RAG)
- Supports follow-up requests, revisions, multi-turn conversation
- Fallback message if agent webhook not connected/configured

### 5.2 Task & Progress Tracking
- "Tasks" tab per agent shows a live feed of runs (scheduled and manual)
- Each task shows: title, status (Queued / Running / Done / Failed), current step description, timestamp
- "View in n8n" link opens the specific workflow execution for admins to inspect/debug
- Status updates pushed by n8n via a shared status-logging sub-workflow

### 5.3 Scheduled & Triggered Automation
- Agents can run on a schedule (e.g., daily content draft at 9am, daily ops summary at 6pm)
- Agents can be triggered by external events (new CRM lead, new support ticket, new file in Drive, etc.)
- Each run is logged to the Tasks feed regardless of trigger type

### 5.4 Rules Engine (Conditional Automation)
- Business rules expressed as conditions → actions within n8n (IF/Switch nodes)
- Examples:
  - If content engagement drops >10% vs. prior week → Content Agent proposes new angles
  - If a sales lead has no activity in 48h → Sales Agent drafts a follow-up
  - If a dev ticket sits in "blocked" >24h → Dev Agent pings the assignee
- v1: rules configured directly in n8n by an admin
- v2 (future): simple rule-builder UI in the frontend that writes config values n8n reads

### 5.5 Knowledge Base Management
- Per-team document upload (brand guidelines, SOPs, templates, past outputs, persona docs)
- Documents indexed into a vector store for retrieval by that team's agent
- Frontend UI to upload, view, and remove documents per team

### 5.6 Cross-Team Collaboration (Orchestrator)
- A project/task can be assigned to the Orchestrator with a goal and required teams
- Orchestrator breaks the goal into subtasks, assigns each to the relevant team agent workflow
- Subtask outputs are collected, and either combined automatically or routed for review
- All subtasks visible in the Tasks feed, grouped under the parent project

### 5.7 Human-in-the-Loop Approvals
- Certain actions (publishing content, sending external emails, modifying CRM records, financial actions) require a human approval step
- Approval requests appear in the frontend (Tasks feed or dedicated "Approvals" view) with Approve/Reject actions
- n8n workflow pauses (via Wait node / webhook resume) until approval is received

### 5.8 Integrations
- Connected per team via n8n's native app nodes or generic HTTP Request/API nodes
- Examples by team:
  - **Content:** Google Drive, Google Sheets (content calendar), Buffer/Meta (publishing)
  - **Design:** Figma, Google Drive
  - **Development:** GitHub, Slack
  - **Marketing:** Meta Ads, Google Ads, Google Analytics
  - **Sales:** CRM (HubSpot/Salesforce), Gmail, Calendar
  - **HR:** Google Drive/Docs, Calendar, email

### 5.9 Settings & Configuration
- Per-agent: webhook URL, system prompt (view/edit reference), connected apps (reference list)
- Global: n8n instance URL (for deep links), default approval thresholds

---

## 6. User Flows

### 6.1 Ad-hoc request
1. User opens Content Agent chat, types a request (e.g., "Write 3 LinkedIn posts about our new feature")
2. Frontend sends message to agent's n8n webhook
3. n8n retrieves brand knowledge base context, calls Claude, returns draft
4. Frontend displays response; user can ask for revisions

### 6.2 Scheduled daily automation
1. n8n schedule trigger fires (e.g., 9:00 AM)
2. Workflow logs "Queued" → "Running" status
3. Agent pulls data from connected apps, generates output (e.g., daily content drafts)
4. Output saved to designated location (Sheet/Drive) and logged as "Done"
5. User checks Tasks tab later, sees the completed run, opens output or "View in n8n"

### 6.3 Cross-team project
1. User submits a project brief to the Orchestrator (e.g., "Launch campaign for new product")
2. Orchestrator creates subtasks: Content (copy), Design (visuals), Marketing (scheduling)
3. Each subtask appears in respective agents' Task feeds
4. As each completes, Orchestrator collects outputs and notifies user when the full project is ready for review

### 6.4 Rule-triggered action with approval
1. Rule condition met (e.g., lead inactive 48h)
2. Sales Agent drafts follow-up email, status set to "Pending Approval"
3. User sees it in Approvals view, reviews draft, clicks Approve
4. n8n resumes workflow, sends email, logs "Done"

---

## 7. Data Model (high-level)

**Task**
- id, agent_id, title, status (queued/running/done/failed/pending_approval), current_step, created_at, updated_at, execution_id, output_ref, parent_project_id (nullable)

**Project** (for cross-team work)
- id, title, goal, status, created_by, created_at

**Agent**
- id, name, team, webhook_url, system_prompt_ref, knowledge_base_id, connected_apps[]

**KnowledgeDocument**
- id, agent/team_id, filename, type, uploaded_at, vector_index_ref

**Rule**
- id, agent_id, condition, action, enabled (boolean), last_triggered_at

---

## 8. Non-Functional Requirements

- **Security:** API keys/credentials stored in n8n's credential store, not in frontend code; frontend access gated by login (role-based: admin vs. team member)
- **Reliability:** failed runs logged with error detail; retries configurable per workflow
- **Performance:** chat responses target <10s for typical content requests
- **Auditability:** every agent action logged with timestamp, inputs/outputs, and (where applicable) the human who approved it
- **Extensibility:** new teams/agents addable by creating a new n8n workflow + adding an entry to the agent config (no frontend redeploy required if config-driven)

---

## 9. Phased Rollout

### Phase 1 — Foundation (MVP)
- Frontend: chat + tasks views (built)
- One agent live: Content Agent (chat-based, manual knowledge base via prompt context)
- Basic n8n workflow: webhook → Claude → response

### Phase 2 — Automation & Visibility
- Add schedule-based automation for Content Agent (daily draft generation)
- Shared status-logging table + live Tasks feed
- Knowledge base via vector store + upload UI

### Phase 3 — Expand Teams
- Add Marketing, Sales agents with relevant integrations
- Add Design, Development, HR agents
- Each new agent follows the same pattern: workflow + system prompt + knowledge base + status logging

### Phase 4 — Cross-Team Orchestration
- Build Orchestrator workflow
- Add Projects view in frontend (grouped subtasks)
- Add Approvals view for human-in-the-loop actions

### Phase 5 — Rules & Optimization
- Add conditional rule workflows per team
- Add simple rule configuration UI in frontend
- Refine prompts/knowledge bases based on usage feedback

---

## 10. Open Questions

- Which app integrations are highest priority per team for v1 (need a shortlist per team)?
- Where should the shared data layer live (Airtable for speed vs. Postgres for scale)?
- What's the approval policy — which actions always require human sign-off vs. fully automated?
- Authentication/access control approach for the frontend (simple login vs. SSO)?
- Hosting: self-hosted n8n vs. n8n Cloud, and where the frontend is deployed?

---

## 11. Success Metrics

- Time saved per team on recurring tasks (e.g., hours/week on content drafting, lead follow-ups)
- % of agent outputs used without major edits
- Number of cross-team projects completed via Orchestrator
- Reduction in missed/delayed routine tasks (e.g., follow-ups, daily reports)