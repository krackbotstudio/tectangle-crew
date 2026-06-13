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
let embeddedLockPath: string | null = null;
export let dbMode: "postgres" | "embedded" = "postgres";

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function acquireEmbeddedLock(dataDir: string): Promise<void> {
  embeddedLockPath = path.join(path.dirname(dataDir), ".agentdesk-api.lock");
  try {
    const raw = await fs.readFile(embeddedLockPath, "utf-8");
    const pid = Number.parseInt(raw.trim(), 10);
    if (Number.isFinite(pid) && isProcessAlive(pid)) {
      throw new Error(
        `Another Agent Desk API is already using the embedded database (PID ${pid}). Stop other "npm run dev" processes and try again.`
      );
    }
    await fs.unlink(embeddedLockPath).catch(() => undefined);
  } catch (err) {
    if (err instanceof Error && err.message.includes("Another Agent Desk API")) {
      throw err;
    }
  }

  await fs.mkdir(path.dirname(embeddedLockPath), { recursive: true });
  await fs.writeFile(embeddedLockPath, String(process.pid), "utf-8");
}

function releaseEmbeddedLock(): void {
  if (!embeddedLockPath) return;
  fs.unlink(embeddedLockPath).catch(() => undefined);
  embeddedLockPath = null;
}

function isEmbeddedDbFailure(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /Aborted|PGlite|database|lock/i.test(message);
}

async function resetEmbeddedDataDir(dataDir: string): Promise<void> {
  releaseEmbeddedLock();
  const backupDir = `${dataDir}.backup-${Date.now()}`;
  await fs.rename(dataDir, backupDir).catch(async () => {
    await fs.rm(dataDir, { recursive: true, force: true });
  });
  await fs.mkdir(dataDir, { recursive: true });
  console.warn(`Embedded database reset. Previous data moved to ${path.basename(backupDir)}`);
}

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

async function openEmbeddedDatabase(dataDir: string): Promise<PGlite> {
  await acquireEmbeddedLock(dataDir);
  const db = new PGlite(dataDir, { extensions: { pgcrypto } });
  await db.query("SELECT 1");
  return db;
}

async function initEmbedded(): Promise<void> {
  const dataDir = path.resolve(config.embeddedDbDir);
  await fs.mkdir(dataDir, { recursive: true });
  dbMode = "embedded";

  try {
    pglite = await openEmbeddedDatabase(dataDir);
  } catch (err) {
    console.error("Embedded database open failed:", err);
    if (!isEmbeddedDbFailure(err)) throw err;
    console.warn("Embedded database failed to open — creating a fresh database...");
    await resetEmbeddedDataDir(dataDir);
    pglite = await openEmbeddedDatabase(dataDir);
  }

  process.on("exit", releaseEmbeddedLock);

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
