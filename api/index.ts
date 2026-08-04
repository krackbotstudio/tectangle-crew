import type { VercelRequest, VercelResponse } from "@vercel/node";
import app, { ensureInit } from "../agentdesk-api/src/app.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureInit();
  return app(req, res);
}
