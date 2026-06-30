import dotenv from "dotenv";

dotenv.config({ path: "../.env" });

const url = `${process.env.SUPABASE_URL}/rest/v1/`;
const key = process.env.SUPABASE_ANON_KEY;

async function run() {
  console.log("Fetching Supabase REST API at", url);
  try {
    const res = await fetch(url, {
      headers: {
        "apikey": key,
        "Authorization": `Bearer ${key}`
      }
    });
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Response:", text.slice(0, 1000));
  } catch (err) {
    console.error("Fetch failed:", err.message);
  }
}

run();
