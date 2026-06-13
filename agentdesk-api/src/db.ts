import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { config } from "./config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, "../../database/migrations");

let pgPool: pg.Pool | null = null;
let pglite: PGlite | null = null;
export let dbMode: "postgres" | "embedded" = "postgres";

async function execSql(sql: string): Promise<void> {
  if (pglite) {
    await pglite.exec(sql);
    return;
  }
  if (pgPool) {
    await pgPool.query(sql);
  }
}

async function runPendingMigrations(): Promise<void> {
  await execSql(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const files = (await fs.readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql") && f !== "001_initial.sql" && f !== "001_embedded.sql" && f !== "002_seed.sql")
    .sort();

  for (const file of files) {
    const applied = await query<{ name: string }>(
      "SELECT name FROM schema_migrations WHERE name = $1",
      [file]
    );
    if (applied.rows.length > 0) continue;

    const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), "utf-8");
    await execSql(sql);
    if (!sql.includes(`INSERT INTO schema_migrations (name) VALUES ('${file}')`)) {
      await query("INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING", [file]);
    }
    console.log(`Applied migration: ${file}`);
  }
}

export async function initDatabase(): Promise<void> {
  if (config.useEmbeddedDb) {
    await initEmbedded();
    return;
  }

  const testPool = new pg.Pool({
    connectionString: config.databaseUrl,
    connectionTimeoutMillis: 3000,
  });

  try {
    await testPool.query("SELECT 1");
    pgPool = testPool;
    dbMode = "postgres";
    console.log("Connected to PostgreSQL");
    await runPendingMigrations();
  } catch {
    await testPool.end().catch(() => undefined);
    console.warn("PostgreSQL unavailable — using embedded PGlite (./data/pglite)");
    await initEmbedded();
  }
}

async function initEmbedded(): Promise<void> {
  const dataDir = path.resolve(config.embeddedDbDir);
  await fs.mkdir(dataDir, { recursive: true });
  pglite = new PGlite(dataDir, { extensions: { pgcrypto } });
  dbMode = "embedded";

  const check = await pglite.query<{ exists: string | null }>(
    "SELECT to_regclass('public.users') AS exists"
  );

  if (!check.rows[0]?.exists) {
    const migrationSql = await fs.readFile(
      path.join(MIGRATIONS_DIR, "001_embedded.sql"),
      "utf-8"
    );
    const seedSql = await fs.readFile(path.join(MIGRATIONS_DIR, "002_seed.sql"), "utf-8");
    await pglite.exec(migrationSql);
    await pglite.exec(seedSql);
    const { seedAdminUser } = await import("./seedData.js");
    await seedAdminUser(pglite);
    console.log("Embedded database initialized and seeded");
  } else {
    const { seedAdminUser } = await import("./seedData.js");
    await seedAdminUser(pglite);
  }

  await runPendingMigrations();
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  if (pglite) {
    return pglite.query(text, params) as Promise<pg.QueryResult<T>>;
  }
  if (!pgPool) {
    throw new Error("Database not initialized");
  }
  return pgPool.query<T>(text, params);
}

export async function getPoolForHealth(): Promise<{ query: (sql: string) => Promise<unknown> }> {
  if (pglite) return pglite;
  if (!pgPool) throw new Error("Database not initialized");
  return pgPool;
}
