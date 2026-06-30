async function run() {
  const targetPrefix = "2406:da14:";
  
  console.log("Fetching AWS IP ranges...");
  const res = await fetch("https://ip-ranges.amazonaws.com/ip-ranges.json");
  const data = await res.json();
  
  console.log("Searching IPv6 prefixes matching prefix:", targetPrefix);
  let matches = 0;
  for (const prefixInfo of data.ipv6_prefixes) {
    if (prefixInfo.ipv6_prefix.toLowerCase().startsWith(targetPrefix.toLowerCase())) {
      console.log(`FOUND MATCH! Prefix: ${prefixInfo.ipv6_prefix}, Region: ${prefixInfo.region}, Service: ${prefixInfo.service}`);
      matches++;
    }
  }
  if (matches === 0) {
    console.log("No exact match found, searching globally for any matching segment...");
    for (const prefixInfo of data.ipv6_prefixes) {
      if (prefixInfo.ipv6_prefix.toLowerCase().includes("da14")) {
        console.log(`PARTIAL MATCH! Prefix: ${prefixInfo.ipv6_prefix}, Region: ${prefixInfo.region}, Service: ${prefixInfo.service}`);
      }
    }
  }
}

run().catch(console.error);
