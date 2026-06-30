import pg from "pg";
import dns from "dns/promises";

const password = "Aqzpn7799@q";
const projectRef = "dwfknxnrsbkkkfwuzpjj";
const user = `postgres.${projectRef}`;
const region = "ap-northeast-1";

async function testCluster(clusterNum) {
  const host = `aws-${clusterNum}-${region}.pooler.supabase.com`;
  console.log(`Testing cluster aws-${clusterNum} (${host})...`);
  
  // Resolve DNS first to avoid waiting for timeout if cluster doesn't exist
  try {
    const ips = await dns.resolve4(host);
    console.log(`  Resolved to: ${ips.join(", ")}`);
  } catch (e) {
    console.error(`  DNS Resolution failed for aws-${clusterNum}: ${e.message}`);
    return;
  }

  const client = new pg.Client({
    host,
    port: 6543,
    user,
    password,
    database: "postgres",
    connectionTimeoutMillis: 5000,
    ssl: { rejectUnauthorized: false }
  });
  try {
    await client.connect();
    console.log(`>>> SUCCESS on cluster: aws-${clusterNum} <<<`);
    const res = await client.query("SELECT NOW()");
    console.log("Result:", res.rows[0]);
    await client.end();
    return true;
  } catch (err) {
    console.error(`  Connection failed on cluster aws-${clusterNum}:`, err.message);
    return false;
  }
}

async function run() {
  for (let i = 0; i <= 10; i++) {
    const success = await testCluster(i);
    if (success) {
      console.log(`\nFound working pooler host: aws-${i}-${region}.pooler.supabase.com`);
      break;
    }
  }
}

run().catch(console.error);
