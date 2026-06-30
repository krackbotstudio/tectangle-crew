import pg from "pg";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import dotenv from "dotenv";
import path from "path";

// Load .env from the root workspace folder
dotenv.config({ path: "../.env" });
dotenv.config();

const isApiDir = process.cwd().endsWith("agentdesk-api");
const localDbPath = isApiDir ? "./data/pglite" : "./agentdesk-api/data/pglite";
const supabaseUrl = process.env.DATABASE_URL;

if (!supabaseUrl || supabaseUrl.includes("localhost")) {
  console.error("ERROR: DATABASE_URL in .env is not set to a remote Supabase connection string!");
  process.exit(1);
}

async function run() {
  console.log("Opening local PGlite database at", path.resolve(localDbPath));
  const localDb = new PGlite(localDbPath, { extensions: { pgcrypto } });

  console.log("Connecting to Supabase...");
  const remoteDb = new pg.Client({
    connectionString: supabaseUrl,
    ssl: { rejectUnauthorized: false }
  });
  await remoteDb.connect();

  const tables = [
    { name: "users", conflictKey: "id" },
    { name: "team_groups", conflictKey: "id" },
    { name: "agents", conflictKey: "id" },
    { name: "agent_board_cards", conflictKey: "id" },
    { name: "projects", conflictKey: "id" },
    { name: "project_agents", conflictKey: "id" },
    { name: "tasks", conflictKey: "id" },
    { name: "knowledge_documents", conflictKey: "id" },
    { name: "knowledge_chunks", conflictKey: "id" },
    { name: "chat_messages", conflictKey: "id" },
    { name: "rules", conflictKey: "id" },
    { name: "work_projects", conflictKey: "id" },
    { name: "activities", conflictKey: "id" },
    { name: "work_tasks", conflictKey: "id" },
    { name: "work_project_activities", conflictKey: ["work_project_id", "activity_id"] },
    { name: "app_settings", conflictKey: "key" },
    { name: "team_tool_requests", conflictKey: "id" },
    { name: "project_tools", conflictKey: "id" },
    { name: "workspace_integrations", conflictKey: "id" },
    { name: "workspace_mcp_connectors", conflictKey: "id" },
    { name: "approvals", conflictKey: "id" },
    { name: "audit_logs", conflictKey: "id" }
  ];

  for (const table of tables) {
    try {
      // Check if table exists in local DB
      const tableCheck = await localDb.query(`SELECT to_regclass('public.${table.name}') AS exists`);
      if (!tableCheck.rows[0] || !tableCheck.rows[0].exists) {
        continue;
      }

      const localRows = await localDb.query(`SELECT * FROM ${table.name}`);
      if (localRows.rows.length === 0) continue;

      // Get column data types to handle json/jsonb correctly
      const typeCheck = await localDb.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1
      `, [table.name]);
      const jsonCols = new Set(
        typeCheck.rows
          .filter(r => r.data_type === 'json' || r.data_type === 'jsonb')
          .map(r => r.column_name)
      );

      console.log(`Syncing ${localRows.rows.length} rows for table: ${table.name}...`);

      const conflictColumns = Array.isArray(table.conflictKey) ? table.conflictKey : [table.conflictKey];
      const conflictStr = conflictColumns.map(c => `"${c}"`).join(", ");

      let successCount = 0;
      let skipCount = 0;

      for (const row of localRows.rows) {
        try {
          const columns = Object.keys(row);
          const values = Object.values(row);

          // Convert values to JSON strings if they are objects/arrays or if the column type is JSON/JSONB
          const cleanValues = columns.map((col, idx) => {
            const val = values[idx];
            if (jsonCols.has(col)) {
              return val !== null && val !== undefined ? JSON.stringify(val) : null;
            }
            if (val && typeof val === "object") {
              return JSON.stringify(val);
            }
            return val;
          });

          const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
          const updateSets = columns
            .filter(col => !conflictColumns.includes(col))
            .map(col => `"${col}" = EXCLUDED."${col}"`)
            .join(", ");

          const queryText = `
            INSERT INTO ${table.name} (${columns.map(c => `"${c}"`).join(", ")})
            VALUES (${placeholders})
            ON CONFLICT (${conflictStr})
            DO ${updateSets.length ? `UPDATE SET ${updateSets}` : "NOTHING"}
          `;

          await remoteDb.query(queryText, cleanValues);
          successCount++;
        } catch (rowErr) {
          if (rowErr.code === "23505") {
            skipCount++;
          } else {
            console.error(`  Failed to sync row for ${table.name}:`, rowErr.message);
          }
        }
      }
      console.log(`  Table ${table.name} done. Synced: ${successCount}, Skipped/Duplicates: ${skipCount}`);
    } catch (err) {
      console.error(`Failed to sync table ${table.name}:`, err);
    }
  }

  await remoteDb.end();
  console.log("SUCCESS: Local data has been synced to Supabase database!");
}

run().catch(console.error);
