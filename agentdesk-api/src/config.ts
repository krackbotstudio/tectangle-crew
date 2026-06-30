import dotenv from "dotenv";

dotenv.config({ path: "../.env" });
dotenv.config();

export const config = {
  port: parseInt(process.env.API_PORT || "3001", 10),
  jwtSecret: process.env.JWT_SECRET || "agentdesk-dev-jwt-secret-change-in-production",
  databaseUrl:
    process.env.DATABASE_URL ||
    "postgresql://agentdesk:agentdesk@localhost:5432/agentdesk",
  n8nBaseUrl: process.env.N8N_BASE_URL || "http://localhost:5678",
  n8nApiKey: process.env.N8N_API_KEY || "",
  webhookSecret: process.env.WEBHOOK_SECRET || "agentdesk-dev-secret",
  uploadDir: process.env.UPLOAD_DIR || "./uploads",
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  googleAiApiKey: process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY || "",
  useEmbeddedDb: process.env.USE_EMBEDDED_DB === "true",
  embeddedDbDir: process.env.EMBEDDED_DB_DIR || "./data/pglite",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  corsOrigins: (process.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:5174")
    .split(",")
    .map((o) => o.trim()),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  googleRedirectUri:
    process.env.GOOGLE_REDIRECT_URI || "http://localhost:3001/api/auth/google/callback",
  allowSignup: process.env.ALLOW_SIGNUP !== "false",
};
