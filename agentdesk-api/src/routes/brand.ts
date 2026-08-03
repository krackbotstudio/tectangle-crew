import fs from "fs/promises";
import path from "path";
import { Router } from "express";
import multer from "multer";
import { authRequired } from "../middleware/auth.js";
import { config } from "../config.js";
import { routeParam } from "../utils/routeParam.js";
import {
  brandLogoPath,
  getBrandGuidelines,
  setBrandLogo,
  updateBrandGuidelines,
} from "../services/brandGuidelines.js";

const router = Router();

const brandDir = () => path.resolve(config.uploadDir, "brand");

const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    const dir = brandDir();
    await fs.mkdir(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".png";
    const safeExt = [".png", ".jpg", ".jpeg", ".webp", ".svg"].includes(ext) ? ext : ".png";
    cb(null, `logo-${Date.now()}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
    if (!allowed.includes(file.mimetype)) {
      cb(new Error("Logo must be PNG, JPG, WebP, or SVG"));
      return;
    }
    cb(null, true);
  },
});

router.get("/", authRequired, async (_req, res) => {
  const brand = await getBrandGuidelines();
  res.json({ brand });
});

router.put("/", authRequired, async (req, res) => {
  const brand = await updateBrandGuidelines(req.user!.id, {
    companyName: req.body.companyName,
    tagline: req.body.tagline,
    logoAltText: req.body.logoAltText,
    primaryColor: req.body.primaryColor,
    secondaryColor: req.body.secondaryColor,
    accentColor: req.body.accentColor,
    fontPrimary: req.body.fontPrimary,
    fontSecondary: req.body.fontSecondary,
    imageStyle: req.body.imageStyle,
    visualKeywords: Array.isArray(req.body.visualKeywords)
      ? req.body.visualKeywords.map(String)
      : typeof req.body.visualKeywords === "string"
        ? req.body.visualKeywords
            .split(",")
            .map((s: string) => s.trim())
            .filter(Boolean)
        : undefined,
    logoPlacement: req.body.logoPlacement,
    doNotes: req.body.doNotes,
    dontNotes: req.body.dontNotes,
    extraRules: req.body.extraRules,
    clearLogo: Boolean(req.body.clearLogo),
  });
  res.json({ brand });
});

router.post("/logo", authRequired, (req, res) => {
  upload.single("logo")(req, res, async (err) => {
    if (err) {
      res.status(400).json({ error: err.message || "Upload failed" });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "logo file is required" });
      return;
    }
    try {
      const brand = await setBrandLogo(req.user!.id, req.file.filename);
      res.json({ brand });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });
});

router.get("/logo/:fileName", authRequired, async (req, res) => {
  const fileName = routeParam(req.params.fileName);
  if (!fileName || fileName.includes("..") || fileName.includes("/") || fileName.includes("\\")) {
    res.status(400).json({ error: "Invalid file name" });
    return;
  }
  const filePath = await brandLogoPath(fileName);
  if (!filePath) {
    res.status(404).json({ error: "Logo not found" });
    return;
  }
  const ext = path.extname(fileName).toLowerCase();
  const mime =
    ext === ".svg"
      ? "image/svg+xml"
      : ext === ".jpg" || ext === ".jpeg"
        ? "image/jpeg"
        : ext === ".webp"
          ? "image/webp"
          : "image/png";
  res.setHeader("Content-Type", mime);
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.sendFile(path.resolve(filePath));
});

export default router;
