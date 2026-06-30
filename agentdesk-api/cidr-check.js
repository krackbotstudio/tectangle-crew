function ipv6ToBigInt(ipStr) {
  // Normalize double colons if any
  let normalized = ipStr.trim();
  if (normalized.includes("::")) {
    const parts = normalized.split("::");
    const left = parts[0] ? parts[0].split(":") : [];
    const right = parts[1] ? parts[1].split(":") : [];
    const missing = 8 - (left.length + right.length);
    const middle = Array(missing).fill("0");
    normalized = [...left, ...middle, ...right].join(":");
  }
  const segments = normalized.split(":").map(s => parseInt(s, 16));
  let result = 0n;
  for (const segment of segments) {
    result = (result << 16n) + BigInt(segment);
  }
  return result;
}

async function run() {
  const targetIpStr = "2406:da14:25a:5800:27da:134b:d9e5:7b0c";
  const targetIpVal = ipv6ToBigInt(targetIpStr);
  
  console.log(`Parsed Target IP: ${targetIpVal.toString(16)}`);
  
  console.log("Fetching AWS IP ranges...");
  const res = await fetch("https://ip-ranges.amazonaws.com/ip-ranges.json");
  const data = await res.json();
  
  console.log("Searching all IPv6 prefixes with proper CIDR matching...");
  for (const prefixInfo of data.ipv6_prefixes) {
    const [prefixIpStr, maskStr] = prefixInfo.ipv6_prefix.split("/");
    const mask = BigInt(maskStr);
    const prefixIpVal = ipv6ToBigInt(prefixIpStr);
    
    // Create mask bigint
    const shift = 128n - mask;
    const maskVal = ((1n << mask) - 1n) << shift;
    
    if ((targetIpVal & maskVal) === (prefixIpVal & maskVal)) {
      console.log(`MATCH FOUND! Prefix: ${prefixInfo.ipv6_prefix}, Region: ${prefixInfo.region}, Service: ${prefixInfo.service}`);
    }
  }
}

run().catch(console.error);
