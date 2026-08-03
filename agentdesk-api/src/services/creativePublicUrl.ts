import { createHmac } from "crypto";
import { config } from "../config.js";

export function signCreativePublicUrl(fileName: string, ttlSeconds = 3600): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${fileName}:${exp}`;
  const sig = createHmac("sha256", config.jwtSecret).update(payload).digest("hex");
  return `${config.apiPublicUrl}/api/creatives/public/${encodeURIComponent(fileName)}?exp=${exp}&sig=${sig}`;
}

export function verifyCreativePublicUrl(fileName: string, exp: string, sig: string): boolean {
  const expNum = parseInt(exp, 10);
  if (!expNum || expNum < Math.floor(Date.now() / 1000)) return false;
  const payload = `${fileName}:${exp}`;
  const expected = createHmac("sha256", config.jwtSecret).update(payload).digest("hex");
  return expected === sig;
}
