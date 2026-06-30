import pg from "pg";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config({ path: "../.env" });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, "../database/migrations");
const supabaseUrl = process.env.DATABASE_URL;

if (!supabaseUrl) {
  console.error("DATABASE_URL is not set in .env!");
  process.exit(1);
}

async function run() {
  console.log("Connecting to Supabase...");
  const remoteDb = new pg.Client({
    connectionString: supabaseUrl,
    ssl: { rejectUnauthorized: false }
  });
  await remoteDb.connect();

  console.log("Creating schema_migrations table if not exists...");
  await remoteDb.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const files = (await fs.readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql") && f !== "001_embedded.sql")
    .sort();

  console.log(`Found ${files.length} migrations to check.`);

  for (const file of files) {
    const appliedCheck = await remoteDb.query(
      "SELECT name FROM schema_migrations WHERE name = $1",
      [file]
    );

    if (appliedCheck.rows.length > 0) {
      console.log(`Migration already applied: ${file}`);
      continue;
    }

    console.log(`Applying migration: ${file}...`);
    const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), "utf-8");
    
    // Begin transaction for safety
    await remoteDb.query("BEGIN");
    try {
      await remoteDb.query(sql);
      
      // Double check if migration SQL already inserts into schema_migrations
      if (!sql.includes(`INSERT INTO schema_migrations (name) VALUES ('${file}')`)) {
        await remoteDb.query("INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING", [file]);
      }
      
      await remoteDb.query("COMMIT");
      console.log(`Successfully applied: ${file}`);
    } catch (err) {
      await remoteDb.query("ROLLBACK");
      console.error(`Failed to apply migration ${file}:`, err.message);
      // Wait, if it fails on vector extension creation (e.g. extension already exists or permissions), let's report it
      if (file === "001_initial.sql" && err.message.includes("extension")) {
        console.log("Retrying 001_initial.sql without CREATE EXTENSION lines...");
        const fallbackSql = sql
          .replace(/CREATE EXTENSION IF NOT EXISTS "pgcrypto";/gi, "")
          .replace(/CREATE EXTENSION IF NOT EXISTS vector;/gi, "");
        await remoteDb.query("BEGIN");
        try {
          await remoteDb.query(fallbackSql);
          await remoteDb.query("INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING", [file]);
          await remoteDb.query("COMMIT");
          console.log(`Successfully applied fallback: ${file}`);
          continue;
        } catch (fallbackErr) {
          await remoteDb.query("ROLLBACK");
          console.error(`Fallback failed too:`, fallbackErr.message);
        }
      }
      throw err;
    }
  }

  await remoteDb.end();
  console.log("All migrations successfully applied on Supabase!");
}

run().catch(console.error);
