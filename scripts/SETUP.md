# Agent Desk local setup (Windows)

Run from the project root in PowerShell:

```powershell
.\scripts\setup.ps1
```

## What it does

1. Creates `.env` from `.env.example` if missing
2. Starts Postgres + n8n via Docker Compose (requires Docker Desktop)
3. Waits for the database to be ready
4. Seeds the admin user and activates the Content Agent
5. Prints URLs and login credentials

## Without Docker

Use a hosted Postgres (free tier):

1. Create a project on [Supabase](https://supabase.com) or [Neon](https://neon.tech)
2. Run the SQL in `database/migrations/001_initial.sql` and `002_seed.sql` in the SQL editor
3. Set `DATABASE_URL` in `.env` to your connection string
4. Run:

```powershell
npm run install:all
npm run seed
npm run dev
```

## After setup

```powershell
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:3001
- n8n: http://localhost:5678

Login: `admin@agentdesk.local` / `admin123`

Import n8n workflows from `agentdesk-n8n/workflows/` — see `agentdesk-n8n/README.md`.
