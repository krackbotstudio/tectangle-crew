import dotenv from "dotenv";

dotenv.config({ path: "../.env" });

const url = `${process.env.SUPABASE_URL}/rest/v1/users`;
const key = process.env.SUPABASE_ANON_KEY;

async function run() {
  console.log("Fetching headers from REST API...");
  try {
    const res = await fetch(url, {
      headers: {
        "apikey": key,
        "Authorization": `Bearer ${key}`
      }
    });
    console.log("Status:", res.status);
    for (const [key, val] of res.headers.entries()) {
      console.log(`${key}: ${val}`);
    }
  } catch (err) {
    console.error("Fetch failed:", err.message);
  }
}

run();
