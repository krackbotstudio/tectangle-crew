import express from "express";
import cors from "cors";
import fs from "fs/promises";
import { config } from "./config.js";
import { LOGO_WORDMARK } from "./brand.js";
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
import { startSocialScheduler } from "./services/socialScheduler.js";
import { dbMode, getPoolForHealth, initDatabase } from "./db.js";
import { repairTemplateProjectLinks } from "./services/projectAgentInstances.js";

const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      if (
        !origin ||
        config.corsOrigins.includes(origin) ||
        /^http:\/\/localhost:\d+$/.test(origin)
      ) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));

app.get("/health", async (_req, res) => {
  try {
    const db = await getPoolForHealth();
    await db.query("SELECT 1");
    res.json({ status: "ok", service: "agentdesk-api", database: dbMode });
  } catch {
    res.status(503).json({ status: "error", message: "Database unavailable" });
  }
});

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

async function start() {
  await initDatabase();
  const repaired = await repairTemplateProjectLinks();
  if (repaired > 0) {
    console.log(`Repaired ${repaired} project group agent(s) — templates replaced with project instances.`);
  }
  await fs.mkdir(config.uploadDir, { recursive: true });
  startSocialScheduler();

  app.listen(config.port, () => {
    console.log(`${LOGO_WORDMARK} API running on http://localhost:${config.port}`);
    console.log(`Database mode: ${dbMode}`);
  });
}

start().catch((err) => {
  console.error("Failed to start API:", err);
  if (err instanceof Error && err.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});

// Trigger restart to load Supabase config
