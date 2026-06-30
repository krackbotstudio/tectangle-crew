import pg from "pg";
import dotenv from "dotenv";

dotenv.config({ path: "../.env" });

const password = "Aqzpn7799@q";
const projectRef = "dwfknxnrsbkkkfwuzpjj";
const user = `postgres.${projectRef}`;

const regions = [
  "eu-south-1",
  "eu-south-2",
  "eu-central-2",
  "me-south-1",
  "me-central-1",
  "af-south-1",
  "ap-east-1",
  "ap-southeast-3",
  "ap-southeast-4",
  "ap-northeast-3"
];

async function testRegion(region) {
  const host = `aws-0-${region}.pooler.supabase.com`;
  console.log(`Testing region ${region} (${host})...`);
  const client = new pg.Client({
    host,
    port: 5432,
    user,
    password,
    database: "postgres",
    connectionTimeoutMillis: 5000,
    ssl: { rejectUnauthorized: false }
  });
  try {
    await client.connect();
    console.log(`>>> SUCCESS on region: ${region} <<<`);
    const res = await client.query("SELECT NOW()");
    console.log("Result:", res.rows[0]);
    await client.end();
    return true;
  } catch (err) {
    console.error(`Failed on region ${region}:`, err.message);
    return false;
  }
}

async function run() {
  for (const region of regions) {
    const success = await testRegion(region);
    if (success) {
      console.log(`\nFound working pooler host: aws-0-${region}.pooler.supabase.com`);
      break;
    }
  }
}

run().catch(console.error);
