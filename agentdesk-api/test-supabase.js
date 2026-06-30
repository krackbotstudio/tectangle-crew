import pg from "pg";
import dotenv from "dotenv";
import dns from "dns";

dns.setDefaultResultOrder("verbatim");

dotenv.config({ path: "../.env" });

const connectionString = process.env.DATABASE_URL;
console.log("Database connection string:", connectionString);

async function run() {
  console.log("Attempting client connection without SSL...");
  const clientWithoutSsl = new pg.Client({ connectionString });
  try {
    await clientWithoutSsl.connect();
    console.log("Success without SSL!");
    const res = await clientWithoutSsl.query("SELECT NOW()");
    console.log("Result:", res.rows[0]);
    await clientWithoutSsl.end();
    return;
  } catch (err) {
    console.error("Failed without SSL:", err.message);
  }

  console.log("Attempting client connection with SSL (rejectUnauthorized: false)...");
  const clientWithSsl = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  try {
    await clientWithSsl.connect();
    console.log("Success with SSL!");
    const res = await clientWithSsl.query("SELECT NOW()");
    console.log("Result:", res.rows[0]);
    await clientWithSsl.end();
  } catch (err) {
    console.error("Failed with SSL:", err.message);
  }
}

run().catch(console.error);
