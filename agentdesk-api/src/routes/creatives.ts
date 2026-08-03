import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import { authRequired } from "../middleware/auth.js";
import { config } from "../config.js";
import { routeParam } from "../utils/routeParam.js";
import {
  getCreativeById,
  listAvailablePublishPlatforms,
  publishCreativeNow,
  scheduleCreative,
} from "../services/creativePublish.js";

const router = Router();

/** Signed public URL for Meta/Instagram image fetch (no auth cookie). */
router.get("/public/:fileName", async (req, res) => {
  const fileName = routeParam(req.params.fileName);
  const exp = String(req.query.exp ?? "");
  const sig = String(req.query.sig ?? "");
  if (!fileName || fileName.includes("..") || fileName.includes("/") || fileName.includes("\\")) {
    res.status(400).json({ error: "Invalid file name" });
    return;
  }
  const { verifyCreativePublicUrl } = await import("../services/creativePublicUrl.js");
  if (!verifyCreativePublicUrl(fileName, exp, sig)) {
    res.status(403).json({ error: "Invalid or expired link" });
    return;
  }

  const filePath = path.join(config.uploadDir, "creatives", fileName);
  try {
    await fs.access(filePath);
  } catch {
    res.status(404).json({ error: "File not found" });
    return;
  }

  const ext = path.extname(fileName).toLowerCase();
  const mime =
    ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : ext === ".webp" ? "image/webp" : "image/png";
  res.setHeader("Content-Type", mime);
  res.sendFile(path.resolve(filePath));
});

router.get("/files/:fileName", authRequired, async (req, res) => {
  const fileName = routeParam(req.params.fileName);
  if (!fileName || fileName.includes("..") || fileName.includes("/")) {
    res.status(400).json({ error: "Invalid file name" });
    return;
  }

  const filePath = path.join(config.uploadDir, "creatives", fileName);
  try {
    await fs.access(filePath);
  } catch {
    res.status(404).json({ error: "File not found" });
    return;
  }

  const ext = path.extname(fileName).toLowerCase();
  const mime =
    ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : ext === ".webp" ? "image/webp" : "image/png";
  res.setHeader("Content-Type", mime);
  res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
  res.sendFile(path.resolve(filePath));
});

router.get("/:id", authRequired, async (req, res) => {
  const creative = await getCreativeById(routeParam(req.params.id));
  if (!creative) {
    res.status(404).json({ error: "Creative not found" });
    return;
  }
  res.json({ creative });
});

router.get("/:id/publish-platforms", authRequired, async (req, res) => {
  const creative = await getCreativeById(routeParam(req.params.id));
  if (!creative) {
    res.status(404).json({ error: "Creative not found" });
    return;
  }
  const platforms = await listAvailablePublishPlatforms(creative.projectId, creative.agentId, req.user!.id);
  res.json({ platforms });
});

router.post("/:id/schedule", authRequired, async (req, res) => {
  const { platform, scheduledAt, notes } = req.body as {
    platform?: string;
    scheduledAt?: string;
    notes?: string;
  };
  if (!platform || !scheduledAt) {
    res.status(400).json({ error: "platform and scheduledAt are required" });
    return;
  }
  const result = await scheduleCreative(routeParam(req.params.id), platform, scheduledAt, notes, req.user!.id);
  if (!result) {
    res.status(404).json({ error: "Creative not found" });
    return;
  }
  res.json(result);
});

router.post("/:id/publish", authRequired, async (req, res) => {
  const { platform, notes } = req.body as { platform?: string; notes?: string };
  if (!platform) {
    res.status(400).json({ error: "platform is required" });
    return;
  }
  const result = await publishCreativeNow(routeParam(req.params.id), platform, notes, req.user!.id);
  if (!result) {
    res.status(404).json({ error: "Creative not found" });
    return;
  }
  res.json(result);
});

export default router;
