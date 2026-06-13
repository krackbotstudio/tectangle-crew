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
import { dbMode, getPoolForHealth, initDatabase } from "./db.js";

const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || config.corsOrigins.includes(origin)) {
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
  await fs.mkdir(config.uploadDir, { recursive: true });

  app.listen(config.port, () => {
    console.log(`Agent Desk API running on http://localhost:${config.port}`);
    console.log(`Database mode: ${dbMode}`);
  });
}

start().catch((err) => {
  console.error("Failed to start API:", err);
  process.exit(1);
});
