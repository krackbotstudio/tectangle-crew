# Agent Desk — n8n Workflows

Import these workflows into your n8n instance (`http://localhost:5678`).

## Prerequisites

1. Docker Compose running (`docker compose up -d`) or n8n running locally
2. Anthropic API credential configured in n8n as `Anthropic API`
3. Environment variable in n8n: `AGENTDESK_API_URL=http://host.docker.internal:3001` (Windows/Mac Docker)
4. **Agent Desk API:** set `N8N_API_KEY` in `.env` (n8n → Settings → API) so workflows can be created from the app

## Create workflows from Agent Desk (recommended)

1. Open any agent → **Automations** tab
2. Ensure n8n is running and `N8N_API_KEY` is set on the API server
3. Click **Create & activate** on **Chat agent** (or Daily schedule)
4. The agent is auto-linked — no manual webhook copy/paste

## Manual import (alternative)

| File | Webhook path | Purpose |
|---|---|---|
| `content-agent-chat.json` | `content-agent-chat` | Chat → RAG context → Claude → reply |
| `status-logger.json` | `status-logger` | Sub-workflow for task status updates |
| `content-agent-daily-draft.json` | — (schedule) | Daily 9 AM content draft generation |
| `knowledge-indexer.json` | `knowledge-indexer` | Optional post-upload notification |

## Import steps

1. Open n8n → **Workflows** → **Import from File**
2. Import each JSON file
3. Open `content-agent-chat` and activate the workflow
4. Copy the **Workflow ID** from the URL into Agent Desk → Content Agent → Settings
5. Ensure webhook path is `content-agent-chat`

## Webhook authentication

All webhooks expect header:

```
X-AgentDesk-Secret: agentdesk-dev-secret
```

Match this with `WEBHOOK_SECRET` in your `.env`.

## Content Agent chat flow

```
Webhook (POST)
  → Log status: running (HTTP → /api/tasks/log)
  → Claude (system prompt + knowledgeContext from payload)
  → Log status: done
  → Respond { reply, taskId }
```

## Daily draft flow

```
Schedule (9:00 AM)
  → Log queued/running
  → Claude (generate 3 draft posts)
  → Log done with output_ref
```

After import, activate workflows and set Content Agent to **active** in Settings.
