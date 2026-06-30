import dns from "dns/promises";

async function run() {
  const ip = "2406:da14:25a:5800:27da:134b:d9e5:7b0c";
  console.log(`Performing reverse DNS lookup for ${ip}...`);
  try {
    const hostnames = await dns.reverse(ip);
    console.log("Hostnames:", hostnames);
  } catch (e) {
    console.error("Reverse DNS lookup failed:", e.message);
  }
}

run();
