# Vercel Deployment Guide for AgentDesk

This project is configured to deploy seamlessly to Vercel as a full-stack monorepo (`agentdesk-web` React frontend + `agentdesk-api` Node/Express Serverless backend).

---

## 🚀 Quick Deployment Options

### Option 1: Deploy via Vercel Dashboard (Recommended)

1. Push your repository to **GitHub / GitLab / Bitbucket**.
2. Go to [Vercel Dashboard](https://vercel.com/new) and click **"Add New Project"**.
3. Import your repository (`tectangle-crew` / `agentdesk`).
4. Vercel will automatically detect the configuration in `vercel.json` and root `package.json`:
   - **Framework Preset**: Vite
   - **Root Directory**: `./` (leave default)
   - **Build Command**: `npm run build`
   - **Output Directory**: `agentdesk-web/dist`
5. Configure Environment Variables (see section below).
6. Click **Deploy**.

---

### Option 2: Deploy via Vercel CLI

1. Install Vercel CLI (if not installed):
   ```bash
   npm i -g vercel
   ```
2. Run `vercel` in the project root:
   ```bash
   vercel
   ```
3. Follow the CLI prompts. When ready for production, deploy with:
   ```bash
   vercel --prod
   ```

---

## 🔑 Environment Variables Setup

Configure the following Environment Variables in **Vercel Project Settings → Environment Variables**:

| Variable Name | Description | Example / Recommended Value |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Supabase, Neon, Railway, Vercel Postgres, etc.) | `postgresql://postgres:...@db.supabase.co:5432/postgres` |
| `JWT_SECRET` | Secret key for signing JWT auth tokens | `a-strong-random-jwt-secret-key` |
| `OPENAI_API_KEY` | (Optional) OpenAI API Key for AI Agents & image generation | `sk-...` |
| `GOOGLE_AI_API_KEY` | (Optional) Gemini API Key | `AIzaSy...` |
| `ANTHROPIC_API_KEY` | (Optional) Claude API Key | `sk-ant-...` |
| `ALLOW_SIGNUP` | Allow user registration (`true` or `false`) | `true` |

---

## 📁 Key Vercel Configuration Files

- [`vercel.json`](file:///f:/tectangle-crew/vercel.json): Configures Vercel rewrites so `/api/*` routes to the serverless backend (`api/index.ts`) and all other routes serve the Single-Page Application (`agentdesk-web`).
- [`api/index.ts`](file:///f:/tectangle-crew/api/index.ts): Vercel Serverless Function entry point wrapping the Express application.
- [`package.json`](file:///f:/tectangle-crew/package.json): Configured with npm workspaces to build `agentdesk-web` and `@vercel/node`.
