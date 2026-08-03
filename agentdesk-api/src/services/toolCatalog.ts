export type ToolCategory =
  | "design"
  | "productivity"
  | "communication"
  | "social"
  | "scheduling"
  | "development"
  | "storage"
  | "analytics"
  | "ai"
  | "other";

export type ProjectToolStatus = "planned" | "requested" | "approved" | "connected" | "disabled";

export interface CatalogTool {
  slug: string;
  name: string;
  category: ToolCategory;
  description: string;
  capabilities: string[];
  connectVia?: "oauth" | "api_key" | "n8n" | "mcp" | "manual";
  liveIntegration?: boolean;
  setupHint?: string;
}

export interface ToolStack {
  id: string;
  name: string;
  description: string;
  toolSlugs: string[];
}

export const TOOL_CATEGORIES: { id: ToolCategory; label: string }[] = [
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
];

export const TOOL_CATALOG: CatalogTool[] = [
  {
    slug: "google-sheets",
    name: "Google Sheets",
    category: "productivity",
    description: "Track content calendars, copy drafts, and campaign status.",
    capabilities: ["read_rows", "write_rows", "content_calendar"],
    connectVia: "api_key",
    liveIntegration: true,
    setupHint:
      "Paste your Google Cloud service account JSON in API secret. Share the spreadsheet with the service account email, then add the spreadsheet ID.",
  },
  {
    slug: "google-docs",
    name: "Google Docs",
    category: "productivity",
    description: "Draft long-form copy and briefs collaboratively.",
    capabilities: ["read_doc", "write_doc"],
    connectVia: "api_key",
    liveIntegration: true,
    setupHint:
      "Paste your Google Cloud service account JSON in API secret. Share the document with the service account email, then add the doc ID.",
  },
  {
    slug: "notion",
    name: "Notion",
    category: "productivity",
    description: "Wiki, briefs, and editorial workflows.",
    capabilities: ["pages", "databases"],
    connectVia: "api_key",
    liveIntegration: true,
    setupHint:
      "Create an internal integration at notion.so/my-integrations and paste the secret token as API key. Add pageId or databaseId in config.",
  },
  {
    slug: "canva",
    name: "Canva",
    category: "design",
    description: "Create social graphics, carousels, and brand templates.",
    capabilities: ["create_design", "export_assets", "brand_kit"],
    connectVia: "oauth",
  },
  {
    slug: "figma",
    name: "Figma",
    category: "design",
    description: "Design system assets and ad creatives with the design team.",
    capabilities: ["read_files", "export_assets", "comments"],
    connectVia: "oauth",
  },
  {
    slug: "meta-business",
    name: "Meta Business Suite",
    category: "social",
    description: "Connect Facebook, Instagram, and WhatsApp business accounts.",
    capabilities: ["facebook_pages", "instagram", "whatsapp_business", "insights"],
    connectVia: "oauth",
    liveIntegration: true,
    setupHint: "Connect via Social → Connect (Meta OAuth). Requires META_APP_ID and META_APP_SECRET.",
  },
  {
    slug: "instagram",
    name: "Instagram",
    category: "social",
    description: "Publish feed posts, reels, and stories.",
    capabilities: ["publish_post", "publish_reel", "publish_story", "insights"],
    connectVia: "oauth",
    liveIntegration: true,
    setupHint: "Connect via Social → Connect (Meta). Instagram Business account must be linked to a Page.",
  },
  {
    slug: "facebook",
    name: "Facebook",
    category: "social",
    description: "Publish page posts and manage community content.",
    capabilities: ["publish_post", "page_inbox", "insights"],
    connectVia: "oauth",
    liveIntegration: true,
    setupHint: "Connect via Social → Connect (Meta OAuth).",
  },
  {
    slug: "whatsapp-business",
    name: "WhatsApp Business",
    category: "social",
    description: "Broadcast updates and customer messaging workflows.",
    capabilities: ["send_message", "templates", "broadcasts"],
    connectVia: "oauth",
  },
  {
    slug: "x-twitter",
    name: "X (Twitter)",
    category: "social",
    description: "Schedule posts and threads on X.",
    capabilities: ["publish_post", "publish_thread", "analytics"],
    connectVia: "oauth",
    liveIntegration: true,
    setupHint: "Connect via Social → Connect. Set X_CLIENT_ID and X_CLIENT_SECRET.",
  },
  {
    slug: "linkedin",
    name: "LinkedIn",
    category: "social",
    description: "Publish company page and personal brand posts.",
    capabilities: ["publish_post", "company_page", "analytics"],
    connectVia: "oauth",
    liveIntegration: true,
    setupHint: "Connect via Social → Connect. Set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET.",
  },
  {
    slug: "tiktok",
    name: "TikTok",
    category: "social",
    description: "Upload and schedule short-form video.",
    capabilities: ["publish_video", "analytics"],
    connectVia: "oauth",
    liveIntegration: true,
    setupHint: "Connect via Social → Connect. Video publish requires an uploaded creative.",
  },
  {
    slug: "buffer",
    name: "Buffer",
    category: "scheduling",
    description: "Queue and schedule posts across channels.",
    capabilities: ["schedule_post", "multi_channel_queue"],
    connectVia: "api_key",
    liveIntegration: true,
    setupHint: "Paste your Buffer access token as API key. Add profileId after listing profiles via agent fetch.",
  },
  {
    slug: "hootsuite",
    name: "Hootsuite",
    category: "scheduling",
    description: "Enterprise social scheduling and approvals.",
    capabilities: ["schedule_post", "approval_workflow"],
    connectVia: "oauth",
  },
  {
    slug: "slack",
    name: "Slack",
    category: "communication",
    description: "Team notifications and approval pings.",
    capabilities: ["post_message", "channels"],
    connectVia: "api_key",
    liveIntegration: true,
    setupHint: "Paste a Slack Bot User OAuth Token (xoxb-…) as API key. Add channel name or ID in config.",
  },
  {
    slug: "google-drive",
    name: "Google Drive",
    category: "storage",
    description: "Store creative assets and exports.",
    capabilities: ["upload_file", "share_link"],
    connectVia: "oauth",
  },
  {
    slug: "google-analytics",
    name: "Google Analytics",
    category: "analytics",
    description: "Measure traffic from social campaigns.",
    capabilities: ["read_reports"],
    connectVia: "oauth",
  },
  {
    slug: "github",
    name: "GitHub",
    category: "development",
    description: "Code repos and automation hooks.",
    capabilities: ["repos", "issues", "webhooks"],
    connectVia: "oauth",
  },
  {
    slug: "n8n",
    name: "n8n",
    category: "ai",
    description: "Automation workflows connecting all tools above.",
    capabilities: ["workflows", "webhooks", "schedules"],
    connectVia: "n8n",
  },
];

export const TOOL_STACKS: ToolStack[] = [
  {
    id: "social-media-management",
    name: "Social media management",
    description:
      "Track content in Sheets, design in Canva/Figma, connect Meta (Instagram, Facebook, WhatsApp), X, and LinkedIn, then schedule and publish.",
    toolSlugs: [
      "google-sheets",
      "canva",
      "figma",
      "meta-business",
      "instagram",
      "facebook",
      "whatsapp-business",
      "x-twitter",
      "linkedin",
      "buffer",
      "n8n",
    ],
  },
  {
    id: "content-editorial",
    name: "Content & editorial",
    description: "Docs, Sheets, Notion, and Slack for drafting and approvals.",
    toolSlugs: ["google-docs", "google-sheets", "notion", "slack", "google-drive"],
  },
  {
    id: "design-production",
    name: "Design production",
    description: "Figma, Canva, and Drive for creative handoff.",
    toolSlugs: ["figma", "canva", "google-drive", "slack"],
  },
];

const catalogBySlug = new Map(TOOL_CATALOG.map((t) => [t.slug, t]));

export function getCatalogTool(slug: string): CatalogTool | undefined {
  return catalogBySlug.get(slug);
}

export function resolveStackTools(stackId: string): CatalogTool[] {
  const stack = TOOL_STACKS.find((s) => s.id === stackId);
  if (!stack) return [];
  return stack.toolSlugs
    .map((slug) => getCatalogTool(slug))
    .filter((t): t is CatalogTool => !!t);
}

export function publicToolCatalog() {
  return {
    categories: TOOL_CATEGORIES,
    tools: TOOL_CATALOG,
    stacks: TOOL_STACKS,
  };
}
