async function run() {
  console.log("Fetching Supabase endpoint...");
  try {
    const res = await fetch("https://dwfknxnrsbkkkfwuzpjj.supabase.co");
    console.log("Status:", res.status);
    console.log("Headers:");
    for (const [key, val] of res.headers.entries()) {
      console.log(`${key}: ${val}`);
    }
  } catch (err) {
    console.error("Fetch failed:", err.message);
  }
}

run();
