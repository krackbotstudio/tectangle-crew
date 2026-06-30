import pg from "pg";
import dotenv from "dotenv";

dotenv.config({ path: "../.env" });

const connectionString = process.env.DATABASE_URL;
console.log("Direct connection string:", connectionString);

async function run() {
  const client = new pg.Client({
    connectionString,
    connectionTimeoutMillis: 10000,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    console.log("Connecting directly...");
    await client.connect();
    console.log(">>> SUCCESS connecting directly! <<<");
    const res = await client.query("SELECT NOW()");
    console.log("Result:", res.rows[0]);
    await client.end();
  } catch (err) {
    console.error("Direct connection failed:", err.message);
  }
}

run();
