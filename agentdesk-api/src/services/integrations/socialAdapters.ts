import type { IntegrationAdapter } from "./types.js";

async function requireToken(ctx: { credentials: { accessToken?: string; apiKey?: string } }, label: string) {
  const token = ctx.credentials.accessToken?.trim() || ctx.credentials.apiKey?.trim();
  if (!token) throw new Error(`${label} access token missing. Connect via Social → Connect.`);
  return token;
}

export const metaBusinessAdapter: IntegrationAdapter = {
  toolSlug: "meta-business",
  async verify(ctx) {
    const token = await requireToken(ctx, "Meta");
    const res = await fetch(
      `https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${encodeURIComponent(token)}`
    );
    const data = (await res.json()) as { name?: string; error?: { message?: string } };
    if (!res.ok) throw new Error(data.error?.message ?? "Meta verify failed");
    return { ok: true, message: `Meta connected as ${data.name ?? "user"}.`, accountLabel: data.name };
  },
  async execute() {
    return { ok: false, message: "Use Social publish for Meta posts." };
  },
};

export const facebookAdapter: IntegrationAdapter = {
  toolSlug: "facebook",
  async verify(ctx) {
    const token = await requireToken(ctx, "Facebook");
    const pageId = String(ctx.config.pageId ?? "");
    if (!pageId) throw new Error("Facebook Page ID missing. Reconnect Meta.");
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${pageId}?fields=id,name&access_token=${encodeURIComponent(token)}`
    );
    const data = (await res.json()) as { name?: string; error?: { message?: string } };
    if (!res.ok) throw new Error(data.error?.message ?? "Facebook verify failed");
    return { ok: true, message: `Facebook Page "${data.name}" connected.`, accountLabel: data.name };
  },
  async execute() {
    return { ok: false, message: "Use Social publish for Facebook posts." };
  },
};

export const instagramAdapter: IntegrationAdapter = {
  toolSlug: "instagram",
  async verify(ctx) {
    const token = await requireToken(ctx, "Instagram");
    const igUserId = String(ctx.config.igUserId ?? "");
    if (!igUserId) throw new Error("Instagram business account missing. Reconnect Meta.");
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${igUserId}?fields=id,username&access_token=${encodeURIComponent(token)}`
    );
    const data = (await res.json()) as { username?: string; error?: { message?: string } };
    if (!res.ok) throw new Error(data.error?.message ?? "Instagram verify failed");
    return {
      ok: true,
      message: `Instagram @${data.username ?? igUserId} connected.`,
      accountLabel: data.username ? `@${data.username}` : undefined,
    };
  },
  async execute() {
    return { ok: false, message: "Use Social publish for Instagram posts (image required)." };
  },
};

export const linkedinAdapter: IntegrationAdapter = {
  toolSlug: "linkedin",
  async verify(ctx) {
    const token = await requireToken(ctx, "LinkedIn");
    const res = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await res.json()) as { name?: string; error_description?: string };
    if (!res.ok) throw new Error(data.error_description ?? "LinkedIn verify failed");
    return { ok: true, message: `LinkedIn connected as ${data.name ?? "member"}.`, accountLabel: data.name };
  },
  async execute() {
    return { ok: false, message: "Use Social publish for LinkedIn posts." };
  },
};

export const xTwitterAdapter: IntegrationAdapter = {
  toolSlug: "x-twitter",
  async verify(ctx) {
    const token = await requireToken(ctx, "X");
    const res = await fetch("https://api.twitter.com/2/users/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await res.json()) as {
      data?: { username: string };
      detail?: string;
    };
    if (!res.ok) throw new Error(data.detail ?? "X verify failed");
    return {
      ok: true,
      message: `X connected as @${data.data?.username ?? "user"}.`,
      accountLabel: data.data ? `@${data.data.username}` : undefined,
    };
  },
  async execute() {
    return { ok: false, message: "Use Social publish for X posts." };
  },
};

export const tiktokAdapter: IntegrationAdapter = {
  toolSlug: "tiktok",
  async verify(ctx) {
    const token = await requireToken(ctx, "TikTok");
    const res = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await res.json()) as {
      data?: { user?: { display_name?: string } };
      error?: { message?: string };
    };
    if (!res.ok) throw new Error(data.error?.message ?? "TikTok verify failed");
    return {
      ok: true,
      message: `TikTok connected as ${data.data?.user?.display_name ?? "user"}.`,
      accountLabel: data.data?.user?.display_name,
    };
  },
  async execute() {
    return { ok: false, message: "TikTok video publish requires an uploaded creative." };
  },
};
