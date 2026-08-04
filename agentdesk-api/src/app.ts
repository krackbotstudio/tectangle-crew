import express from "express";
import cors from "cors";
import fs from "fs/promises";
import { config } from "./config.js";
import authRoutes from "./routes/auth.js";
import agentsRoutes from "./routes/agents.js";
import tasksRoutes from "./routes/tasks.js";
import chatRoutes from "./routes/chat.js";
import knowledgeRoutes from "./routes/knowledge.js";
import teamsRoutes from "./routes/teams.js";
import projectsRoutes from "./routes/projects.js";
import n8nRoutes from "./routes/n8n.js";
import usersRoutes from "./routes/users.js";
import workRoutes from "./routes/work.js";
import settingsRoutes from "./routes/settings.js";
import toolsRoutes from "./routes/tools.js";
import consoleRoutes from "./routes/console.js";
import creativesRoutes from "./routes/creatives.js";
import socialRoutes from "./routes/social.js";
import socialOauthRoutes from "./routes/socialOauth.js";
import networksRoutes from "./routes/networks.js";
import brandRoutes from "./routes/brand.js";
import { startSocialScheduler } from "./services/socialScheduler.js";
import { dbMode, getPoolForHealth, initDatabase } from "./db.js";
import { repairTemplateProjectLinks } from "./services/projectAgentInstances.js";

const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      if (
        !origin ||
        process.env.VERCEL ||
        config.corsOrigins.includes(origin) ||
        /^http:\/\/localhost:\d+$/.test(origin) ||
        /^https:\/\/.*\.vercel\.app$/.test(origin)
      ) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));

let initPromise: Promise<void> | null = null;

export async function ensureInit(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await initDatabase();
      const repaired = await repairTemplateProjectLinks().catch((err) => {
        console.error("Template project link repair note:", err);
        return 0;
      });
      if (repaired > 0) {
        console.log(`Repaired ${repaired} project group agent(s).`);
      }
      await fs.mkdir(config.uploadDir, { recursive: true }).catch(() => undefined);
      if (!process.env.VERCEL) {
        startSocialScheduler();
      }
    })();
  }
  return initPromise;
}

app.use(async (_req, _res, next) => {
  try {
    await ensureInit();
    next();
  } catch (err) {
    next(err);
  }
});

const handleHealth = async (_req: express.Request, res: express.Response) => {
  try {
    const db = await getPoolForHealth();
    await db.query("SELECT 1");
    res.json({ status: "ok", service: "agentdesk-api", database: dbMode });
  } catch {
    res.status(503).json({ status: "error", message: "Database unavailable" });
  }
};

app.get("/health", handleHealth);
app.get("/api/health", handleHealth);

app.use("/api/auth", authRoutes);
app.use("/api/agents", agentsRoutes);
app.use("/api/tasks", tasksRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/knowledge", knowledgeRoutes);
app.use("/api/teams", teamsRoutes);
app.use("/api/projects", projectsRoutes);
app.use("/api/n8n", n8nRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/work", workRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/tools", toolsRoutes);
app.use("/api/console", consoleRoutes);
app.use("/api/creatives", creativesRoutes);
app.use("/api/social", socialRoutes);
app.use("/api/social/oauth", socialOauthRoutes);
app.use("/api/networks", networksRoutes);
app.use("/api/brand", brandRoutes);

// Fallbacks if routes hit without /api prefix
app.use("/auth", authRoutes);
app.use("/agents", agentsRoutes);
app.use("/tasks", tasksRoutes);
app.use("/chat", chatRoutes);
app.use("/knowledge", knowledgeRoutes);
app.use("/teams", teamsRoutes);
app.use("/projects", projectsRoutes);
app.use("/n8n", n8nRoutes);
app.use("/users", usersRoutes);
app.use("/work", workRoutes);
app.use("/settings", settingsRoutes);
app.use("/tools", toolsRoutes);
app.use("/console", consoleRoutes);
app.use("/creatives", creativesRoutes);
app.use("/social", socialRoutes);
app.use("/social/oauth", socialOauthRoutes);
app.use("/networks", networksRoutes);
app.use("/brand", brandRoutes);

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
);

export default app;
