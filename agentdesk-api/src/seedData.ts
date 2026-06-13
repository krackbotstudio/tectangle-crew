import bcrypt from "bcryptjs";
import type pg from "pg";
import type { PGlite } from "@electric-sql/pglite";
import { query } from "./db.js";

type Db = pg.Pool | PGlite;

export async function seedAdminUser(db?: Db): Promise<void> {
  const passwordHash = await bcrypt.hash("admin123", 10);
  const run = db
    ? (sql: string, params?: unknown[]) => db.query(sql, params)
    : (sql: string, params?: unknown[]) => query(sql, params);

  await run(
    `INSERT INTO users (email, password_hash, name, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    ["admin@agentdesk.local", passwordHash, "Admin User", "admin"]
  );

  await run(
    `UPDATE agents SET is_active = true, chat_webhook_path = 'content-agent-chat'
     WHERE slug = 'content'`
  );
}
