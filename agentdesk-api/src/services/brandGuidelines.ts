import fs from "fs/promises";
import path from "path";
import { query } from "../db.js";
import { config } from "../config.js";

export interface BrandGuidelinesRow {
  id: string;
  company_name: string | null;
  tagline: string | null;
  logo_file_name: string | null;
  logo_alt_text: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  font_primary: string | null;
  font_secondary: string | null;
  image_style: string;
  visual_keywords: string[];
  logo_placement: string;
  do_notes: string | null;
  dont_notes: string | null;
  extra_rules: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export function mapBrandGuidelines(row: BrandGuidelinesRow) {
  return {
    id: row.id,
    companyName: row.company_name,
    tagline: row.tagline,
    logoFileName: row.logo_file_name,
    logoUrl: row.logo_file_name ? `/brand/logo/${row.logo_file_name}` : null,
    logoAltText: row.logo_alt_text,
    primaryColor: row.primary_color,
    secondaryColor: row.secondary_color,
    accentColor: row.accent_color,
    fontPrimary: row.font_primary,
    fontSecondary: row.font_secondary,
    imageStyle: row.image_style,
    visualKeywords: row.visual_keywords ?? [],
    logoPlacement: row.logo_placement,
    doNotes: row.do_notes,
    dontNotes: row.dont_notes,
    extraRules: row.extra_rules,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type BrandGuidelines = ReturnType<typeof mapBrandGuidelines>;

function emptyToNull(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export async function getBrandGuidelines(): Promise<BrandGuidelines> {
  const existing = await query<BrandGuidelinesRow>(
    `SELECT * FROM brand_guidelines ORDER BY created_at ASC LIMIT 1`
  );
  if (existing.rows[0]) return mapBrandGuidelines(existing.rows[0]);

  const inserted = await query<BrandGuidelinesRow>(
    `INSERT INTO brand_guidelines (company_name) VALUES (NULL) RETURNING *`
  );
  return mapBrandGuidelines(inserted.rows[0]);
}

export async function updateBrandGuidelines(
  userId: string,
  input: {
    companyName?: string | null;
    tagline?: string | null;
    logoAltText?: string | null;
    primaryColor?: string | null;
    secondaryColor?: string | null;
    accentColor?: string | null;
    fontPrimary?: string | null;
    fontSecondary?: string | null;
    imageStyle?: string;
    visualKeywords?: string[];
    logoPlacement?: string;
    doNotes?: string | null;
    dontNotes?: string | null;
    extraRules?: string | null;
    clearLogo?: boolean;
  }
): Promise<BrandGuidelines> {
  const current = await getBrandGuidelines();

  const result = await query<BrandGuidelinesRow>(
    `UPDATE brand_guidelines SET
       company_name = $2,
       tagline = $3,
       logo_alt_text = $4,
       primary_color = $5,
       secondary_color = $6,
       accent_color = $7,
       font_primary = $8,
       font_secondary = $9,
       image_style = COALESCE($10, image_style),
       visual_keywords = COALESCE($11::text[], '{}'),
       logo_placement = COALESCE($12, logo_placement),
       do_notes = $13,
       dont_notes = $14,
       extra_rules = $15,
       logo_file_name = CASE WHEN $16 THEN NULL ELSE logo_file_name END,
       updated_by = $17,
       updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      current.id,
      emptyToNull(input.companyName),
      emptyToNull(input.tagline),
      emptyToNull(input.logoAltText),
      emptyToNull(input.primaryColor),
      emptyToNull(input.secondaryColor),
      emptyToNull(input.accentColor),
      emptyToNull(input.fontPrimary),
      emptyToNull(input.fontSecondary),
      input.imageStyle ?? null,
      input.visualKeywords ?? [],
      input.logoPlacement ?? null,
      emptyToNull(input.doNotes),
      emptyToNull(input.dontNotes),
      emptyToNull(input.extraRules),
      Boolean(input.clearLogo),
      userId,
    ]
  );

  if (input.clearLogo && current.logoFileName) {
    try {
      await fs.unlink(path.join(config.uploadDir, "brand", current.logoFileName));
    } catch {
      /* ignore */
    }
  }

  return mapBrandGuidelines(result.rows[0]);
}

export async function setBrandLogo(userId: string, fileName: string): Promise<BrandGuidelines> {
  const current = await getBrandGuidelines();
  if (current.logoFileName && current.logoFileName !== fileName) {
    try {
      await fs.unlink(path.join(config.uploadDir, "brand", current.logoFileName));
    } catch {
      /* ignore missing old logo */
    }
  }
  const result = await query<BrandGuidelinesRow>(
    `UPDATE brand_guidelines SET
       logo_file_name = $2,
       updated_by = $3,
       updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [current.id, fileName, userId]
  );
  return mapBrandGuidelines(result.rows[0]);
}

export async function brandLogoPath(fileName: string): Promise<string | null> {
  const filePath = path.join(config.uploadDir, "brand", fileName);
  try {
    await fs.access(filePath);
    return filePath;
  } catch {
    return null;
  }
}

/** Strict visual constraints injected into every image generation prompt. */
export function formatBrandImageConstraints(brand: BrandGuidelines): string {
  if (
    !brand.companyName &&
    !brand.tagline &&
    !brand.logoAltText &&
    !brand.primaryColor &&
    !brand.secondaryColor &&
    !brand.accentColor &&
    !brand.fontPrimary &&
    !brand.fontSecondary &&
    !brand.visualKeywords.length &&
    !brand.doNotes &&
    !brand.dontNotes &&
    !brand.extraRules &&
    !brand.logoFileName
  ) {
    return "";
  }

  const hasLogoFile = Boolean(brand.logoFileName);
  const lines: string[] = [
    "=== MANDATORY BRAND GUIDELINES (must follow exactly — override any other style) ===",
    "These rules are authoritative. Ignore conflicting generic marketing aesthetics.",
    "CRITICAL — NO TEXT IN THE IMAGE: Do not render headlines, slogans, CTAs, banners, feature labels, UI chrome, watermarks, or any readable lettering.",
    "Generate a clean photographic/illustration SCENE only. Branding (logo + color bar) is added in post-production.",
  ];

  if (brand.companyName) {
    lines.push(`Subject / brand world: "${brand.companyName}" (do not write this name as text in the image).`);
  }
  if (brand.tagline) {
    lines.push(`Mood inspired by tagline "${brand.tagline}" — convey visually, never as text.`);
  }

  if (hasLogoFile || brand.logoPlacement !== "none") {
    lines.push(
      "Leave the bottom ~18% of the frame relatively simple/uncluttered (solid floor, soft blur, or calm negative space) for a brand footer strip.",
      "Do NOT invent, redraw, or approximate any logo, wordmark, or app icon."
    );
  }

  const colors = [
    brand.primaryColor && `PRIMARY ${brand.primaryColor}`,
    brand.secondaryColor && `SECONDARY ${brand.secondaryColor}`,
    brand.accentColor && `ACCENT ${brand.accentColor}`,
  ].filter(Boolean);
  if (colors.length) {
    lines.push(
      `COLOR SYSTEM (strict): ${colors.join(" · ")}.`,
      `Wardrobe accents, scooter/vehicle accents, props, lighting gels, and set details should echo ${brand.primaryColor || "primary"} and ${brand.secondaryColor || "secondary"}.`,
      "Do not introduce competing brand palettes (no purple, no random corporate red headers, no neon) unless those hexes are listed above."
    );
  }

  if (brand.fontPrimary || brand.fontSecondary) {
    // Fonts only matter if any tiny text slips through — still discourage text
    lines.push("Typography is handled in post — do not paint fonts into the image.");
  }

  lines.push(`Image type / style (required): ${styleLabel(brand.imageStyle)}.`);

  if (brand.visualKeywords.length) {
    lines.push(`Must include visual cues of: ${brand.visualKeywords.join(", ")}.`);
  }

  if (brand.doNotes?.trim()) lines.push(`DO: ${brand.doNotes.trim()}`);
  if (brand.dontNotes?.trim()) {
    lines.push(`DON'T: ${brand.dontNotes.trim()}`);
  }
  lines.push("DON'T: typos, fake ads, banner layouts, poster typography, QR codes with fake text, price tags with letters.");

  if (brand.extraRules?.trim()) lines.push(`Extra rules: ${brand.extraRules.trim()}`);

  lines.push("No watermarks, no unrelated brand marks, no stock logo placeholders.");
  lines.push("===============================================");
  return lines.join("\n");
}

function styleLabel(style: string) {
  const map: Record<string, string> = {
    photorealistic: "photorealistic photography",
    cinematic: "cinematic dramatic lighting",
    illustration: "polished illustration",
    flat: "flat graphic design",
    "3d": "3D rendered product visual",
    minimal: "minimal clean composition",
    product_shot: "studio product photography",
  };
  return map[style] ?? style;
}
