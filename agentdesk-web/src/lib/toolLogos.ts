/** Brand logos via Simple Icons CDN (https://github.com/simple-icons/simple-icons, CC0). */

export interface ToolLogoMeta {
  /** Simple Icons slug */
  icon: string;
  /** Brand hex color without # */
  color?: string;
}

const TOOL_LOGO_MAP: Record<string, ToolLogoMeta> = {
  "google-sheets": { icon: "googlesheets", color: "34A853" },
  "google-docs": { icon: "googledocs", color: "4285F4" },
  notion: { icon: "notion", color: "FFFFFF" },
  canva: { icon: "canva", color: "00C4CC" },
  figma: { icon: "figma", color: "F24E1E" },
  "meta-business": { icon: "meta", color: "0081FB" },
  instagram: { icon: "instagram", color: "FF0069" },
  facebook: { icon: "facebook", color: "0866FF" },
  "whatsapp-business": { icon: "whatsapp", color: "25D366" },
  "x-twitter": { icon: "x", color: "FFFFFF" },
  linkedin: { icon: "linkedin", color: "0A66C2" },
  tiktok: { icon: "tiktok", color: "FE2C55" },
  buffer: { icon: "buffer", color: "168EEA" },
  hootsuite: { icon: "hootsuite", color: "FF6C02" },
  slack: { icon: "slack", color: "4A154B" },
  "google-drive": { icon: "googledrive", color: "4285F4" },
  "google-analytics": { icon: "googleanalytics", color: "E37400" },
  github: { icon: "github", color: "FFFFFF" },
  n8n: { icon: "n8n", color: "EA4B71" },
};

export function getToolLogoMeta(slug: string): ToolLogoMeta | null {
  return TOOL_LOGO_MAP[slug] ?? null;
}

export function getToolLogoUrl(slug: string): string | null {
  const meta = TOOL_LOGO_MAP[slug];
  if (!meta) return null;
  if (meta.color) {
    return `https://cdn.simpleicons.org/${meta.icon}/${meta.color}`;
  }
  return `https://cdn.simpleicons.org/${meta.icon}`;
}
