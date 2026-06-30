import dns from "dns/promises";

async function run() {
  const host = "db.dwfknxnrsbkkkfwuzpjj.supabase.co";
  console.log(`Resolving DNS for ${host}...`);
  try {
    const a = await dns.resolve4(host).catch(() => []);
    console.log("IPv4 (A):", a);
  } catch (e) {
    console.error("IPv4 failed:", e.message);
  }
  try {
    const aaaa = await dns.resolve6(host).catch(() => []);
    console.log("IPv6 (AAAA):", aaaa);
  } catch (e) {
    console.error("IPv6 failed:", e.message);
  }
  try {
    const cname = await dns.resolveCname(host).catch(() => []);
    console.log("CNAME:", cname);
  } catch (e) {
    console.error("CNAME failed:", e.message);
  }
  try {
    const txt = await dns.resolveTxt(host).catch(() => []);
    console.log("TXT:", txt);
  } catch (e) {
    console.error("TXT failed:", e.message);
  }
  try {
    const srv = await dns.resolveSrv(host).catch(() => []);
    console.log("SRV:", srv);
  } catch (e) {
    console.error("SRV failed:", e.message);
  }
}

run();
