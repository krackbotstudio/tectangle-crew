import bcrypt from "bcryptjs";
import type pg from "pg";
import type { PGlite } from "@electric-sql/pglite";
import { query } from "./db.js";

type Db = pg.Pool | PGlite;

async function execQuery(db: Db, sql: string, params?: unknown[]): Promise<void> {
  await (db as pg.Pool).query(sql, params);
}

export async function seedAdminUser(db?: Db): Promise<void> {
  const passwordHash = await bcrypt.hash("admin123", 10);
  const adminSql = `INSERT INTO users (email, password_hash, name, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`;
  const adminParams = ["admin@agentdesk.local", passwordHash, "Admin User", "admin"];
  const agentSql = `UPDATE agents SET is_active = true, chat_webhook_path = 'content-agent-chat'
     WHERE slug = 'content'`;

  if (db) {
    await execQuery(db, adminSql, adminParams);
    await execQuery(db, agentSql);
    return;
  }

  await query(adminSql, adminParams);
  await query(agentSql);
}
