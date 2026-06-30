import pg from "pg";

const host = "aws-1-ap-northeast-1.pooler.supabase.com";
const user = "postgres.dwfknxnrsbkkkfwuzpjj";
const password = "Aqzpn7799@q";

async function run() {
  console.log(`Connecting to ${host}:5432...`);
  const client = new pg.Client({
    host,
    port: 5432,
    user,
    password,
    database: "postgres",
    ssl: { rejectUnauthorized: false }
  });
  try {
    await client.connect();
    console.log(">>> SUCCESS on port 5432! <<<");
    const res = await client.query("SELECT NOW()");
    console.log("Result:", res.rows[0]);
    await client.end();
  } catch (err) {
    console.error("Connection failed on port 5432:", err.message);
  }
}

run();
