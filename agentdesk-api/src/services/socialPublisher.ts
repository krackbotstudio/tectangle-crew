import { loadIntegrationContext } from "./integrations/credentials.js";
import { executeIntegrationTool } from "./integrations/index.js";
import { query } from "../db.js";
import { getWorkspaceIntegrationBySlug } from "./workspaceIntegrations.js";
import path from "path";
import fs from "fs/promises";
import { config } from "../config.js";

export const PLATFORM_INTEGRATION: Record<string, string[]> = {
  instagram: ["instagram", "meta-business"],
  facebook: ["facebook", "meta-business"],
  linkedin: ["linkedin"],
  "x-twitter": ["x-twitter"],
  tiktok: ["tiktok"],
  buffer: ["buffer"],
};

export interface PublishInput {
  userId: string;
  platform: string;
  content: string;
  handle?: string;
  creativeId?: string;
  creativeFileName?: string;
}

export interface PublishResult {
  success: boolean;
  externalPostId?: string;
  message: string;
  live: boolean;
}

export async function isPlatformConnected(platform: string): Promise<boolean> {
  const slugs = PLATFORM_INTEGRATION[platform] ?? [platform];
  for (const slug of slugs) {
    const integration = await getWorkspaceIntegrationBySlug(slug);
    if (integration?.status === "connected") return true;
  }
  return false;
}

async function resolveCreativePath(creativeId?: string, fileName?: string): Promise<string | null> {
  const candidates: string[] = [];
  if (fileName) {
    candidates.push(path.join(config.uploadDir, "creatives", fileName));
    candidates.push(path.join(config.uploadDir, fileName));
  }
  if (creativeId) {
    const row = await query<{ file_name: string }>(
      `SELECT file_name FROM agent_creatives WHERE id = $1`,
      [creativeId]
    );
    if (row.rows[0]) {
      candidates.push(path.join(config.uploadDir, "creatives", row.rows[0].file_name));
      candidates.push(path.join(config.uploadDir, row.rows[0].file_name));
    }
  }
  for (const p of candidates) {
    try {
      await fs.access(p);
      return p;
    } catch {
      /* try next */
    }
  }
  return null;
}

export async function publishToSocialPlatform(input: PublishInput): Promise<PublishResult> {
  const connected = await isPlatformConnected(input.platform);
  const handleLabel = input.handle ? ` @${input.handle.replace(/^@/, "")}` : "";

  if (!connected) {
    return {
      success: false,
      live: false,
      message: `Cannot publish to ${input.platform}${handleLabel}: connect the platform under Social → Connect (OAuth), then try again.`,
    };
  }

  try {
    switch (input.platform) {
      case "facebook":
        return await publishFacebook(input);
      case "instagram":
        return await publishInstagram(input);
      case "linkedin":
        return await publishLinkedIn(input);
      case "x-twitter":
        return await publishX(input);
      case "buffer":
        return await publishBuffer(input);
      case "tiktok":
        return {
          success: false,
          live: false,
          message:
            "TikTok is connected, but video publish requires an uploaded video asset. Attach a creative or use Design Agent to generate media first.",
        };
      default:
        return {
          success: false,
          live: false,
          message: `No live publisher for ${input.platform}.`,
        };
    }
  } catch (error) {
    return {
      success: false,
      live: true,
      message: (error as Error).message || `Failed to publish to ${input.platform}`,
    };
  }
}

async function loadCreds(slug: string) {
  const ctx = await loadIntegrationContext(slug);
  if (!ctx) throw new Error(`${slug} is not configured`);
  const token = ctx.credentials.accessToken?.trim() || ctx.credentials.apiKey?.trim();
  if (!token) throw new Error(`${slug} has no access token. Reconnect via Social → Connect.`);
  return { ctx, token };
}

async function publishFacebook(input: PublishInput): Promise<PublishResult> {
  let ctx = await loadIntegrationContext("facebook");
  if (!ctx?.credentials.accessToken && !ctx?.credentials.apiKey) {
    ctx = await loadIntegrationContext("meta-business");
  }
  if (!ctx) throw new Error("Facebook / Meta is not connected");

  const pageToken =
    ctx.credentials.accessToken?.trim() ||
    ctx.credentials.apiKey?.trim() ||
    "";
  if (!pageToken) throw new Error("Facebook page token missing. Reconnect Meta.");

  const pageId =
    String(ctx.config.pageId ?? ctx.config.defaultPageId ?? "").trim() ||
    (Array.isArray(ctx.config.pages)
      ? String((ctx.config.pages as Array<{ id: string }>)[0]?.id ?? "")
      : "");

  if (!pageId) throw new Error("No Facebook Page selected. Reconnect Meta and grant Page access.");

  const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: input.content,
      access_token: pageToken,
    }),
  });
  const data = (await res.json()) as { id?: string; error?: { message?: string } };
  if (!res.ok || !data.id) {
    throw new Error(data.error?.message ?? `Facebook publish failed (${res.status})`);
  }

  return {
    success: true,
    live: true,
    externalPostId: data.id,
    message: `Published to Facebook${input.handle ? ` @${input.handle}` : ""}. Post ID: ${data.id}`,
  };
}

async function publishInstagram(input: PublishInput): Promise<PublishResult> {
  const ctx =
    (await loadIntegrationContext("instagram")) ??
    (await loadIntegrationContext("meta-business"));
  if (!ctx) throw new Error("Instagram / Meta is not connected");

  const pageToken = ctx.credentials.accessToken?.trim() || ctx.credentials.apiKey?.trim();
  if (!pageToken) throw new Error("Instagram token missing. Reconnect Meta.");

  const igUserId = String(ctx.config.igUserId ?? ctx.config.defaultIgUserId ?? "").trim();
  if (!igUserId) {
    throw new Error(
      "No Instagram Business account linked to your Meta Page. Link IG in Meta Business Suite, then reconnect."
    );
  }

  // Instagram Graph API requires an image URL for feed posts. Text-only is not supported.
  const filePath = await resolveCreativePath(input.creativeId, input.creativeFileName);
  if (!filePath) {
    // Fall back: create a text-only note via Facebook if available, else fail clearly.
    throw new Error(
      "Instagram feed posts require an image. Generate or attach a creative, then publish again. Caption is ready."
    );
  }

  // Public signed URL for IG container
  const fileName = path.basename(filePath);
  const { signCreativePublicUrl } = await import("./creativePublicUrl.js");
  const imageUrl = signCreativePublicUrl(fileName);

  const createRes = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image_url: imageUrl,
      caption: input.content,
      access_token: pageToken,
    }),
  });
  const created = (await createRes.json()) as { id?: string; error?: { message?: string } };
  if (!createRes.ok || !created.id) {
    throw new Error(
      created.error?.message ??
        `Instagram media create failed. Ensure ${imageUrl} is publicly reachable by Meta.`
    );
  }

  const pubRes = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      creation_id: created.id,
      access_token: pageToken,
    }),
  });
  const published = (await pubRes.json()) as { id?: string; error?: { message?: string } };
  if (!pubRes.ok || !published.id) {
    throw new Error(published.error?.message ?? "Instagram publish failed");
  }

  return {
    success: true,
    live: true,
    externalPostId: published.id,
    message: `Published to Instagram. Media ID: ${published.id}`,
  };
}

async function publishLinkedIn(input: PublishInput): Promise<PublishResult> {
  const { ctx, token } = await loadCreds("linkedin");
  const author = String(ctx.config.personUrn ?? "").trim();
  if (!author) throw new Error("LinkedIn person URN missing. Reconnect LinkedIn.");

  const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: input.content },
          shareMediaCategory: "NONE",
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    }),
  });

  const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok) {
    throw new Error(data.message ?? `LinkedIn publish failed (${res.status})`);
  }

  const id = data.id ?? res.headers.get("x-restli-id") ?? `li-${Date.now()}`;
  return {
    success: true,
    live: true,
    externalPostId: id,
    message: `Published to LinkedIn. Post ID: ${id}`,
  };
}

async function publishX(input: PublishInput): Promise<PublishResult> {
  const { token } = await loadCreds("x-twitter");
  const res = await fetch("https://api.twitter.com/2/tweets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: input.content.slice(0, 280) }),
  });
  const data = (await res.json()) as {
    data?: { id: string };
    detail?: string;
    title?: string;
  };
  if (!res.ok || !data.data?.id) {
    throw new Error(data.detail ?? data.title ?? `X publish failed (${res.status})`);
  }
  return {
    success: true,
    live: true,
    externalPostId: data.data.id,
    message: `Published to X. Tweet ID: ${data.data.id}`,
  };
}

async function publishBuffer(input: PublishInput): Promise<PublishResult> {
  const result = await executeIntegrationTool("buffer", {
    action: "write",
    config: { content: input.content },
    content: input.content,
  });
  if (!result.ok) {
    return { success: false, live: true, message: result.message };
  }
  let externalPostId = `buffer-${Date.now().toString(36)}`;
  if (result.data) {
    try {
      const parsed = JSON.parse(result.data) as { updateIds?: string[] };
      if (parsed.updateIds?.[0]) externalPostId = parsed.updateIds[0];
    } catch {
      /* keep generated */
    }
  }
  return {
    success: true,
    live: true,
    externalPostId,
    message: result.message,
  };
}

export async function resolveSocialAccount(
  userId: string,
  platform: string,
  handle?: string
): Promise<{ id: string; handle: string } | null> {
  if (handle) {
    const normalized = handle.replace(/^@/, "").trim();
    const result = await query<{ id: string; handle: string }>(
      `SELECT id, handle FROM social_accounts
       WHERE user_id = $1 AND platform = $2 AND LOWER(handle) = LOWER($3) AND is_active = true`,
      [userId, platform, normalized]
    );
    if (result.rows[0]) return result.rows[0];
  }

  const fallback = await query<{ id: string; handle: string }>(
    `SELECT id, handle FROM social_accounts
     WHERE user_id = $1 AND platform = $2 AND is_active = true
     ORDER BY updated_at DESC LIMIT 1`,
    [userId, platform]
  );
  return fallback.rows[0] ?? null;
}
