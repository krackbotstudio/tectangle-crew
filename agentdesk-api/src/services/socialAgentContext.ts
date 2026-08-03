import { query } from "../db.js";
import { listSocialAccounts } from "./socialAccounts.js";
import { listSocialPosts } from "./socialPosts.js";
import { isPlatformConnected, PLATFORM_INTEGRATION } from "./socialPublisher.js";
import { ASK_QUESTIONS_PROMPT } from "./agentQuestions.js";

const SOCIAL_PLATFORM_IDS = Object.keys(PLATFORM_INTEGRATION);

export function isSocialMediaAgent(agent: {
  slug: string;
  name?: string;
  parent_agent_id?: string | null;
  skills?: string[];
}): boolean {
  if (agent.slug === "social-media-manager" || agent.slug.startsWith("social-media-manager-")) {
    return true;
  }
  const name = (agent.name ?? "").toLowerCase();
  if (name.includes("social media")) return true;
  const skills = agent.skills ?? [];
  return skills.some((s) => /social content|multi-platform scheduling|brand voice/i.test(s));
}

export async function buildSocialWorkspaceContext(input: {
  userId: string;
  projectId?: string | null;
  projectTitle?: string | null;
  projectGoal?: string | null;
  projectDescription?: string | null;
}): Promise<string> {
  const accounts = await listSocialAccounts(input.userId);
  const posts = await listSocialPosts(input.userId, input.projectId ?? undefined);

  const connectionLines: string[] = [];
  for (const platform of SOCIAL_PLATFORM_IDS) {
    if (platform === "buffer") continue;
    const connected = await isPlatformConnected(platform);
    const handles = accounts
      .filter((a) => a.platform === platform && a.isActive)
      .map((a) => `@${a.handle}${a.displayName ? ` (${a.displayName})` : ""}`);
    connectionLines.push(
      `- ${platform}: OAuth ${connected ? "CONNECTED" : "not connected"}${
        handles.length ? ` — handles: ${handles.join(", ")}` : " — no handles yet"
      }`
    );
  }

  const queue = posts.filter((p) => p.status === "scheduled" || p.status === "draft").slice(0, 12);
  const recentPublished = posts.filter((p) => p.status === "published").slice(0, 8);
  const failed = posts.filter((p) => p.status === "failed").slice(0, 5);

  const parts: string[] = [
    "=== BUSINESS & SOCIAL WORKSPACE CONTEXT ===",
    "Use this as ground truth about the business and current social setup. Do not invent brands, products, or accounts that conflict with this.",
  ];

  if (input.projectTitle || input.projectGoal || input.projectDescription) {
    parts.push("\nBusiness / project:");
    if (input.projectTitle) parts.push(`- Name: ${input.projectTitle}`);
    if (input.projectGoal?.trim()) parts.push(`- Goal: ${input.projectGoal.trim()}`);
    if (input.projectDescription?.trim()) parts.push(`- Description: ${input.projectDescription.trim()}`);
  } else {
    parts.push(
      "\nNo project brief is loaded. Ask clarifying questions about the business (what they sell, who they serve, offer, tone, goals) before proposing strategy."
    );
  }

  parts.push("\nConnected platforms & handles:");
  parts.push(...connectionLines);

  if (queue.length) {
    parts.push("\nUpcoming / draft posts:");
    for (const p of queue) {
      const when = p.scheduledAt ? new Date(p.scheduledAt).toISOString() : "unscheduled";
      parts.push(
        `- [${p.status}] ${p.platform}${p.handle ? ` @${p.handle}` : ""} @ ${when}: ${p.content.slice(0, 120)}${p.content.length > 120 ? "…" : ""}`
      );
    }
  } else {
    parts.push("\nUpcoming / draft posts: (none)");
  }

  if (recentPublished.length) {
    parts.push("\nRecently published:");
    for (const p of recentPublished) {
      parts.push(
        `- ${p.platform}${p.handle ? ` @${p.handle}` : ""}: ${p.content.slice(0, 100)}${p.content.length > 100 ? "…" : ""}`
      );
    }
  }

  if (failed.length) {
    parts.push("\nFailed posts (need fix or reconnect):");
    for (const p of failed) {
      parts.push(`- ${p.platform}: ${p.errorDetail ?? "unknown error"}`);
    }
  }

  try {
    const { getGtmProfile, formatGtmBrief } = await import("./networkGtm.js");
    const { listCampaigns } = await import("./networkCampaigns.js");
    const gtm = await getGtmProfile(input.userId, input.projectId);
    if (gtm) {
      parts.push("\nNetwork / GTM profile (from Networks hub):");
      parts.push(formatGtmBrief(gtm));
    }
    const campaigns = await listCampaigns(input.userId);
    if (campaigns.length) {
      parts.push("\nRecent network campaigns:");
      for (const c of campaigns.slice(0, 5)) {
        parts.push(`- [${c.status}] ${c.title}${c.goal ? ` — ${c.goal}` : ""}`);
      }
    }
    parts.push(
      "\nFor community discovery and assisted outreach, point users to the Networks hub (/networks)."
    );
  } catch {
    /* network tables may not be migrated yet */
  }

  parts.push(
    "\nIf a platform the user wants is not CONNECTED, tell them to open Social → Connect and complete OAuth before live publish."
  );
  parts.push("==========================================");

  return parts.join("\n");
}

/** Full operating playbook for strategy → publish */
export const SOCIAL_MEDIA_MANAGER_PROMPT = `
=== SOCIAL MEDIA MANAGER — END-TO-END OPERATING SYSTEM ===
You own social for this business: strategy, planning, content creation, scheduling, and publishing.

## Your workflow (follow in order unless the user jumps ahead)
1. UNDERSTAND — Know the business before recommending tactics.
   - Use BUSINESS & SOCIAL WORKSPACE CONTEXT + knowledge base.
   - If anything critical is missing (offer, audience, tone, goals, platforms), use ask_questions.
2. STRATEGY — Propose positioning, pillars, platforms, cadence, and KPIs in plain language.
3. PLAN — Build a dated content calendar (themes, platforms, formats, CTAs).
4. CREATE — Write platform-native copy (and request Design Agent / generate_image for visuals when needed).
5. SCHEDULE — After user confirms, emit schedule actions (or plan_campaign).
6. PUBLISH — Only when the user says publish now / go live; otherwise schedule for auto-publish.
7. REPORT — Summarize what was scheduled/published and what is blocked (OAuth, missing image, etc.).

## Business understanding rules
- Anchor every idea to the real product/service, audience, and goals from context.
- Never invent a different company, product category, or competitor set.
- Mirror brand voice from knowledge docs and prior posts when available.
- Prefer fewer strong posts over spam.

## Platform craft
- LinkedIn: professional, insight-led, longer OK.
- Instagram: caption + hook + CTA; feed publish needs an image creativeId.
- X (Twitter): ≤280 chars; punchy.
- Facebook: conversational, community-friendly.
- TikTok: short script/hook; video creative usually required.

## Confirmation gates
- Ask before scheduling a full campaign.
- Ask before live publish unless the user already said "publish now".
- If OAuth is not CONNECTED for a platform, do not pretend to publish — guide them to Social → Connect.

## Actions (emit JSON — you may emit multiple fenced json blocks in one reply)

Ask clarifying questions:
\`\`\`json
{
  "action": "ask_questions",
  "intro": "Quick questions so I can tailor your social strategy:",
  "questions": [
    { "id": "audience", "label": "Who is the primary audience?", "type": "text", "required": true },
    { "id": "goal", "label": "Main goal this month?", "type": "single", "options": ["Awareness", "Leads", "Engagement", "Launches"], "required": true },
    { "id": "platforms", "label": "Which platforms matter most?", "type": "multi", "options": ["Instagram", "LinkedIn", "Facebook", "X", "TikTok"] }
  ]
}
\`\`\`

Schedule one post:
\`\`\`json
{
  "action": "schedule_post",
  "platform": "linkedin",
  "content": "Full post copy",
  "handle": "brandhandle",
  "scheduledAt": "2026-08-01T09:00:00.000Z"
}
\`\`\`

Publish immediately:
\`\`\`json
{
  "action": "publish_post",
  "platform": "x-twitter",
  "content": "Tweet text under 280 chars"
}
\`\`\`

Schedule a whole campaign in one action (preferred after user confirms the plan):
\`\`\`json
{
  "action": "plan_campaign",
  "theme": "Launch week",
  "posts": [
    {
      "platform": "linkedin",
      "content": "…",
      "scheduledAt": "2026-08-01T09:00:00.000Z"
    },
    {
      "platform": "instagram",
      "content": "…",
      "scheduledAt": "2026-08-01T11:00:00.000Z",
      "creativeId": "optional-uuid-if-known"
    }
  ]
}
\`\`\`

Request a visual (when you are also the design-capable agent or coordinating creatives):
\`\`\`json
{
  "action": "generate_image",
  "prompt": "Brand-aligned social graphic description",
  "width": 1080,
  "height": 1080,
  "purpose": "instagram_feed"
}
\`\`\`

Platforms: instagram, facebook, linkedin, x-twitter, tiktok, buffer.
After actions succeed, tell the user to review Social → Calendar / Posts. Auto-publish runs for scheduled items.
${ASK_QUESTIONS_PROMPT}
`.trim();
