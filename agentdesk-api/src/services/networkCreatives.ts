import { query } from "../db.js";
import { loadAiConfig, resolveProviderApiKey } from "./aiSettings.js";
import { generateAgentImage } from "./imageGeneration.js";
import { mapCreative, type CreativeRow } from "./creativePublish.js";
import { getCommunitiesByIds, mapCommunity } from "./networkCatalog.js";
import { formatGtmBrief, getGtmProfile, mapGtmProfile } from "./networkGtm.js";
import type { CollateralPack } from "./networkAi.js";
import { formatBrandImageConstraints, getBrandGuidelines } from "./brandGuidelines.js";
import { applyBrandLogoOverlay } from "./brandLogoOverlay.js";

type Profile = ReturnType<typeof mapGtmProfile>;
type Community = ReturnType<typeof mapCommunity>;

export type CreativeMode = "shared" | "individual";

export interface NetworkCreativeItem {
  creativeId: string;
  communityId: string | null;
  platform: string;
  label: string;
  purpose: string;
  downloadUrl: string;
  width: number | null;
  height: number | null;
  prompt: string;
}

async function resolveCreativeAgentId(): Promise<string> {
  const preferred = await query<{ id: string }>(
    `SELECT id FROM agents
     WHERE slug = 'design'
        OR slug LIKE 'design-%'
        OR slug = 'social-media-manager'
        OR slug LIKE 'social-media-manager-%'
     ORDER BY CASE
       WHEN slug = 'design' THEN 0
       WHEN slug LIKE 'design-%' THEN 1
       WHEN slug = 'social-media-manager' THEN 2
       ELSE 3
     END,
     is_active DESC
     LIMIT 1`
  );
  if (preferred.rows[0]) return preferred.rows[0].id;

  const any = await query<{ id: string }>(
    `SELECT id FROM agents ORDER BY is_active DESC, created_at ASC LIMIT 1`
  );
  if (!any.rows[0]) {
    throw new Error("No agent available to own generated creatives. Seed agents or create one first.");
  }
  return any.rows[0].id;
}

function assertImageProviderReady(aiConfig: Awaited<ReturnType<typeof loadAiConfig>>) {
  const openaiKey = resolveProviderApiKey(aiConfig, "openai");
  const googleKey = resolveProviderApiKey(aiConfig, "google");
  const openaiOk = Boolean(openaiKey && aiConfig.providers.openai.enabled);
  const googleOk = Boolean(googleKey && aiConfig.providers.google.enabled);
  if (openaiOk || googleOk) return;
  throw new Error(
    "Image generation needs OpenAI or Google AI with an API key. Anthropic can write copy but cannot generate images — add a key under Settings → AI models."
  );
}

export function purposeForNetworkPlatform(platform: string): string {
  switch (platform) {
    case "linkedin":
      return "linkedin";
    case "x-twitter":
      return "x_twitter";
    case "facebook":
      return "facebook";
    case "instagram":
      return "instagram_feed";
    case "producthunt":
      return "square";
    case "tiktok":
      return "instagram_reel";
    default:
      return "square";
  }
}

function buildVisualPrompt(input: {
  profile: Profile;
  channelLabel: string;
  platform: string;
  purposeLabel: string;
  postSnippet?: string;
  brandBlock?: string;
}): string {
  const brief = formatGtmBrief(input.profile);
  // Copy is for mood only — never ask the model to paint ad copy into the frame
  const mood = (input.postSnippet || "").replace(/\s+/g, " ").trim().slice(0, 160);
  return [
    input.brandBlock ? input.brandBlock : "",
    `Create a single square marketing SCENE for "${input.profile.productName || "the product"}" (${input.purposeLabel}, ${input.channelLabel}).`,
    "Composition: lifestyle / product-in-context visual. One clear focal subject. No collage, no poster layout, no multi-banner template.",
    "TEXT RULE: zero readable text anywhere in the image (no headlines, buttons, captions, packaging words, or logos).",
    input.brandBlock
      ? "Brand guidelines above are mandatory for palette and style. Product brief is subject matter only."
      : `Style: ${input.profile.brandVoice || "clean, modern, credible"}.`,
    "",
    "PRODUCT BRIEF:",
    brief,
    mood ? `\nMOOD (visual only, do not write this text): ${mood}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function generateAndStoreCreative(input: {
  projectId?: string | null;
  agentId: string;
  userId: string;
  prompt: string;
  purpose: string;
  brand: Awaited<ReturnType<typeof getBrandGuidelines>>;
  metadata: Record<string, unknown>;
  aiConfig: Awaited<ReturnType<typeof loadAiConfig>>;
}) {
  const generated = await generateAgentImage(input.aiConfig, {
    prompt: input.prompt,
    purpose: input.purpose,
  });

  let fileName = generated.fileName;
  let mimeType = generated.mimeType;
  let logoApplied = false;
  try {
    const overlaid = await applyBrandLogoOverlay(fileName, input.brand);
    if (overlaid.applied) {
      fileName = overlaid.fileName;
      mimeType = "image/png";
      logoApplied = true;
    }
  } catch {
    /* keep unbranded file if overlay fails */
  }

  return insertCreative({
    projectId: input.projectId,
    agentId: input.agentId,
    userId: input.userId,
    prompt: input.prompt,
    purposeLabel: generated.purposeLabel,
    width: generated.width,
    height: generated.height,
    fileName,
    mimeType,
    provider: generated.provider,
    metadata: { ...input.metadata, brandId: input.brand.id, logoApplied },
  });
}

async function insertCreative(input: {
  projectId?: string | null;
  agentId: string;
  userId: string;
  prompt: string;
  purposeLabel: string;
  width: number;
  height: number;
  fileName: string;
  mimeType: string;
  provider: string;
  metadata?: Record<string, unknown>;
}) {
  const result = await query<CreativeRow>(
    `INSERT INTO agent_creatives
       (project_id, agent_id, user_id, prompt, purpose, width, height, file_name, mime_type, provider, status, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'generated',$11::jsonb)
     RETURNING *`,
    [
      input.projectId ?? null,
      input.agentId,
      input.userId,
      input.prompt,
      input.purposeLabel,
      input.width,
      input.height,
      input.fileName,
      input.mimeType,
      input.provider,
      JSON.stringify(input.metadata ?? {}),
    ]
  );
  return mapCreative(result.rows[0]);
}

function toNetworkItem(
  creative: ReturnType<typeof mapCreative>,
  meta: { communityId: string | null; platform: string; label: string }
): NetworkCreativeItem {
  return {
    creativeId: creative.id,
    communityId: meta.communityId,
    platform: meta.platform,
    label: meta.label,
    purpose: creative.purpose ?? "square",
    downloadUrl: creative.downloadUrl,
    width: creative.width,
    height: creative.height,
    prompt: creative.prompt,
  };
}

export async function generateNetworkCreatives(input: {
  userId: string;
  projectId?: string | null;
  mode: CreativeMode;
  communityIds: string[];
  collateral?: CollateralPack | null;
}): Promise<{ mode: CreativeMode; creatives: NetworkCreativeItem[] }> {
  const profile = await getGtmProfile(input.userId, input.projectId);
  if (!profile) {
    throw new Error("Save a GTM profile before generating images.");
  }

  const aiConfig = await loadAiConfig();
  assertImageProviderReady(aiConfig);
  const agentId = await resolveCreativeAgentId();
  const communities = await getCommunitiesByIds(input.communityIds);
  if (!communities.length) {
    throw new Error("Select at least one community/channel for creatives.");
  }

  const brand = await getBrandGuidelines();
  const brandBlock = formatBrandImageConstraints(brand);

  const creatives: NetworkCreativeItem[] = [];

  if (input.mode === "shared") {
    const purpose = "square";
    const prompt = buildVisualPrompt({
      profile,
      channelLabel: "multi-channel launch",
      platform: "shared",
      purposeLabel: "Square launch creative",
      postSnippet: input.collateral?.launchPost ?? input.collateral?.summary,
      brandBlock,
    });
    const creative = await generateAndStoreCreative({
      projectId: input.projectId,
      agentId,
      userId: input.userId,
      prompt,
      purpose,
      brand,
      aiConfig,
      metadata: { networkMode: "shared", source: "network_engine" },
    });
    creatives.push(
      toNetworkItem(creative, {
        communityId: null,
        platform: "shared",
        label: "One creative for all channels",
      })
    );
    return { mode: "shared", creatives };
  }

  const targets = communities.slice(0, 8);
  for (const community of targets) {
    const platform = community.ownedSocialPlatform ?? community.platform;
    const purpose = purposeForNetworkPlatform(platform);
    const postSnippet = pickSnippetForCommunity(community, input.collateral);
    const prompt = buildVisualPrompt({
      profile,
      channelLabel: community.name,
      platform,
      purposeLabel: purpose.replace(/_/g, " "),
      postSnippet,
      brandBlock,
    });
    const creative = await generateAndStoreCreative({
      projectId: input.projectId,
      agentId,
      userId: input.userId,
      prompt,
      purpose,
      brand,
      aiConfig,
      metadata: {
        networkMode: "individual",
        communityId: community.id,
        platform,
        source: "network_engine",
      },
    });
    creatives.push(
      toNetworkItem(creative, {
        communityId: community.id,
        platform,
        label: community.name,
      })
    );
  }

  return { mode: "individual", creatives };
}

function pickSnippetForCommunity(
  community: Community,
  pack?: CollateralPack | null
): string | undefined {
  if (!pack) return undefined;
  if (community.ownedSocialPlatform === "linkedin") return pack.linkedinPost;
  if (community.ownedSocialPlatform === "x-twitter") return pack.xPost;
  if (/producthunt|waitlist|upcoming/i.test(community.slug)) return pack.waitlistCta;
  return pack.launchPost;
}

export function resolveCreativeIdForCommunity(
  communityId: string,
  mode: CreativeMode | "none" | undefined,
  creatives: { communityId?: string | null; creativeId: string }[] | undefined,
  sharedCreativeId?: string | null
): string | null {
  if (!mode || mode === "none") return null;
  if (mode === "shared") {
    return sharedCreativeId ?? creatives?.find((c) => !c.communityId)?.creativeId ?? creatives?.[0]?.creativeId ?? null;
  }
  return creatives?.find((c) => c.communityId === communityId)?.creativeId ?? null;
}
