export const TOOL_CATEGORIES = [
  { id: "social", label: "Social platforms" },
  { id: "scheduling", label: "Scheduling & publishing" },
  { id: "design", label: "Design & creatives" },
  { id: "productivity", label: "Content & tracking" },
  { id: "communication", label: "Communication" },
  { id: "development", label: "Development" },
  { id: "storage", label: "Storage" },
  { id: "analytics", label: "Analytics" },
  { id: "ai", label: "AI & automation" },
  { id: "other", label: "Other" },
] as const;

/** Quick-pick tools shown in team configure (full catalog via API). */
export const TOOL_CATALOG = [
  { name: "Google Sheets", category: "productivity", slug: "google-sheets" },
  { name: "Canva", category: "design", slug: "canva" },
  { name: "Figma", category: "design", slug: "figma" },
  { name: "Meta Business Suite", category: "social", slug: "meta-business" },
  { name: "Instagram", category: "social", slug: "instagram" },
  { name: "Facebook", category: "social", slug: "facebook" },
  { name: "WhatsApp Business", category: "social", slug: "whatsapp-business" },
  { name: "X (Twitter)", category: "social", slug: "x-twitter" },
  { name: "LinkedIn", category: "social", slug: "linkedin" },
  { name: "Buffer", category: "scheduling", slug: "buffer" },
  { name: "Notion", category: "productivity", slug: "notion" },
  { name: "Slack", category: "communication", slug: "slack" },
  { name: "n8n", category: "ai", slug: "n8n" },
] as const;

export const REQUEST_STATUS_META: Record<
  string,
  { label: string; className: string }
> = {
  requested: { label: "Requested", className: "bg-amber-500/15 text-amber-200 border-amber-500/30" },
  approved: { label: "Approved", className: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30" },
  rejected: { label: "Rejected", className: "bg-red-500/15 text-red-200 border-red-500/30" },
  provisioned: { label: "Provisioned", className: "bg-sky-500/15 text-sky-200 border-sky-500/30" },
};
