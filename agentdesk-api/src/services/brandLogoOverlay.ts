import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { config } from "../config.js";
import type { BrandGuidelines } from "./brandGuidelines.js";
import { brandLogoPath } from "./brandGuidelines.js";

function hexOr(value: string | null | undefined, fallback: string) {
  return value && /^#[0-9A-Fa-f]{6}$/.test(value) ? value : fallback;
}

/**
 * Post-process a generated creative:
 * - Adds a clean brand color footer (exact hex from Brand page)
 * - Stamps the uploaded logo at a readable size
 * Models invent text/logos poorly; we keep generation as scene-only and brand in code.
 */
export async function applyBrandLogoOverlay(
  creativeFileName: string,
  brand: BrandGuidelines
): Promise<{ fileName: string; applied: boolean }> {
  if (brand.logoPlacement === "none") {
    return { fileName: creativeFileName, applied: false };
  }

  const creativePath = path.join(config.uploadDir, "creatives", creativeFileName);
  try {
    await fs.access(creativePath);
  } catch {
    return { fileName: creativeFileName, applied: false };
  }

  const primary = hexOr(brand.primaryColor, "#FE8B00");
  const secondary = hexOr(brand.secondaryColor, "#751F00");
  const accent = hexOr(brand.accentColor, "#000000");

  const base = sharp(creativePath);
  const meta = await base.metadata();
  const width = meta.width ?? 1024;
  const height = meta.height ?? 1024;

  const footerH = Math.max(110, Math.round(height * 0.16));
  const stripeH = Math.max(6, Math.round(footerH * 0.08));
  const pad = Math.round(Math.min(width, footerH) * 0.12);

  let logoBuf: Buffer | null = null;
  let logoW = 0;
  let logoH = 0;

  if (brand.logoFileName) {
    const logoPath = await brandLogoPath(brand.logoFileName);
    if (logoPath) {
      const logoMaxH = Math.round(footerH * 0.62);
      const logoMaxW = Math.round(width * 0.32);
      logoBuf = await sharp(logoPath)
        .resize({
          width: logoMaxW,
          height: logoMaxH,
          fit: "inside",
          withoutEnlargement: false,
        })
        .png()
        .toBuffer();
      const logoMeta = await sharp(logoBuf).metadata();
      logoW = logoMeta.width ?? logoMaxW;
      logoH = logoMeta.height ?? logoMaxH;
    }
  }

  // Wordmark fallback when no logo file — render brand name in primary color
  let wordmarkBuf: Buffer | null = null;
  let wordW = 0;
  let wordH = 0;
  if (!logoBuf && brand.companyName) {
    const fontSize = Math.round(footerH * 0.32);
    const approxW = Math.min(width - pad * 2, Math.round(brand.companyName.length * fontSize * 0.62));
    const svg = `<svg width="${approxW}" height="${Math.round(footerH * 0.7)}" xmlns="http://www.w3.org/2000/svg">
      <text x="0" y="${Math.round(footerH * 0.48)}"
        font-family="${brand.fontPrimary || "Arial, Helvetica, sans-serif"}, sans-serif"
        font-size="${fontSize}" font-weight="700" fill="${primary}">${escapeXml(brand.companyName)}</text>
    </svg>`;
    wordmarkBuf = Buffer.from(svg);
    wordW = approxW;
    wordH = Math.round(footerH * 0.7);
  }

  const markW = logoW || wordW;
  const markH = logoH || wordH;
  const markBuf = logoBuf || wordmarkBuf;

  let markLeft = width - markW - pad;
  let markTop = height - footerH + Math.round((footerH - markH) / 2);

  switch (brand.logoPlacement) {
    case "top_center":
      // Still use footer for reliability; center the mark
      markLeft = Math.round((width - markW) / 2);
      break;
    case "bottom_center":
    case "prominent":
      markLeft = Math.round((width - markW) / 2);
      break;
    case "subtle_corner":
    default:
      markLeft = width - markW - pad;
      break;
  }

  markLeft = Math.max(pad, Math.min(markLeft, width - markW - pad));
  markTop = Math.max(height - footerH + Math.round(pad * 0.4), Math.min(markTop, height - markH - Math.round(pad * 0.4)));

  const footerSvg = Buffer.from(
    `<svg width="${width}" height="${footerH}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${accent}"/>
      <rect y="0" width="100%" height="${stripeH}" fill="${primary}"/>
      <rect y="${stripeH}" width="100%" height="2" fill="${secondary}"/>
    </svg>`
  );

  const composites: Array<{ input: Buffer; left: number; top: number }> = [
    { input: footerSvg, left: 0, top: height - footerH },
  ];
  if (markBuf) {
    composites.push({ input: markBuf, left: markLeft, top: markTop });
  }

  const outName = creativeFileName.replace(/(\.[^.]+)$/, "-branded.png");
  const outPath = path.join(config.uploadDir, "creatives", outName);

  await base.composite(composites).png({ quality: 90 }).toFile(outPath);

  try {
    await fs.unlink(creativePath);
  } catch {
    /* keep original if delete fails */
  }

  return { fileName: outName, applied: true };
}

function escapeXml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
