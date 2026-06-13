export const TOOL_CATEGORIES = [
  { id: "design", label: "Design" },
  { id: "productivity", label: "Productivity" },
  { id: "communication", label: "Communication" },
  { id: "development", label: "Development" },
  { id: "storage", label: "Storage" },
  { id: "analytics", label: "Analytics" },
  { id: "ai", label: "AI & automation" },
  { id: "other", label: "Other" },
] as const;

export const TOOL_CATALOG = [
  { name: "Figma", category: "design" },
  { name: "Canva", category: "design" },
  { name: "Adobe Creative Cloud", category: "design" },
  { name: "Google Docs", category: "productivity" },
  { name: "Google Sheets", category: "productivity" },
  { name: "Notion", category: "productivity" },
  { name: "Slack", category: "communication" },
  { name: "Microsoft Teams", category: "communication" },
  { name: "Zoom", category: "communication" },
  { name: "GitHub", category: "development" },
  { name: "GitLab", category: "development" },
  { name: "Jira", category: "development" },
  { name: "Linear", category: "development" },
  { name: "Google Drive", category: "storage" },
  { name: "Dropbox", category: "storage" },
  { name: "Google Analytics", category: "analytics" },
  { name: "HubSpot", category: "analytics" },
  { name: "OpenAI API", category: "ai" },
  { name: "Zapier", category: "ai" },
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
