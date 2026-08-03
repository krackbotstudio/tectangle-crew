import { randomBytes, createHash } from "crypto";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { upsertWorkspaceIntegration } from "./workspaceIntegrations.js";
import { createSocialAccount } from "./socialAccounts.js";

export type SocialOauthPlatform =
  | "meta"
  | "instagram"
  | "facebook"
  | "linkedin"
  | "x-twitter"
  | "tiktok";

interface OauthState {
  userId: string;
  platform: SocialOauthPlatform;
  nonce: string;
}

export function socialOauthConfigured(platform: SocialOauthPlatform): boolean {
  switch (platform) {
    case "meta":
    case "instagram":
    case "facebook":
      return Boolean(config.metaAppId && config.metaAppSecret);
    case "linkedin":
      return Boolean(config.linkedinClientId && config.linkedinClientSecret);
    case "x-twitter":
      return Boolean(config.xClientId && config.xClientSecret);
    case "tiktok":
      return Boolean(config.tiktokClientKey && config.tiktokClientSecret);
    default:
      return false;
  }
}

export function listSocialOauthProviders() {
  return [
    {
      id: "meta" as const,
      label: "Meta (Instagram + Facebook)",
      platforms: ["instagram", "facebook"],
      configured: socialOauthConfigured("meta"),
      description: "Connect Pages and Instagram Business accounts via Meta Login.",
    },
    {
      id: "linkedin" as const,
      label: "LinkedIn",
      platforms: ["linkedin"],
      configured: socialOauthConfigured("linkedin"),
      description: "Publish to your LinkedIn profile.",
    },
    {
      id: "x-twitter" as const,
      label: "X (Twitter)",
      platforms: ["x-twitter"],
      configured: socialOauthConfigured("x-twitter"),
      description: "Post tweets with OAuth 2.0.",
    },
    {
      id: "tiktok" as const,
      label: "TikTok",
      platforms: ["tiktok"],
      configured: socialOauthConfigured("tiktok"),
      description: "Connect TikTok for Business content posting.",
    },
  ];
}

function redirectUri(platform: SocialOauthPlatform): string {
  const key =
    platform === "instagram" || platform === "facebook" ? "meta" : platform;
  return `${config.apiPublicUrl}/api/social/oauth/${key}/callback`;
}

export function createOauthState(userId: string, platform: SocialOauthPlatform): string {
  const payload: OauthState = {
    userId,
    platform,
    nonce: randomBytes(8).toString("hex"),
  };
  return jwt.sign(payload, config.jwtSecret, { expiresIn: "15m" });
}

export function parseOauthState(state: string): OauthState {
  return jwt.verify(state, config.jwtSecret) as OauthState;
}

export function buildOauthAuthorizeUrl(userId: string, platform: SocialOauthPlatform): string {
  if (!socialOauthConfigured(platform)) {
    throw new Error(`${platform} OAuth is not configured. Add client credentials to the API .env.`);
  }

  const state = createOauthState(userId, platform === "instagram" || platform === "facebook" ? "meta" : platform);
  const key = platform === "instagram" || platform === "facebook" ? "meta" : platform;

  if (key === "meta") {
    const params = new URLSearchParams({
      client_id: config.metaAppId,
      redirect_uri: redirectUri("meta"),
      state,
      response_type: "code",
      scope: [
        "pages_show_list",
        "pages_manage_posts",
        "pages_read_engagement",
        "instagram_basic",
        "instagram_content_publish",
        "business_management",
      ].join(","),
    });
    return `https://www.facebook.com/v21.0/dialog/oauth?${params}`;
  }

  if (key === "linkedin") {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: config.linkedinClientId,
      redirect_uri: redirectUri("linkedin"),
      state,
      scope: "openid profile email w_member_social",
    });
    return `https://www.linkedin.com/oauth/v2/authorization?${params}`;
  }

  if (key === "x-twitter") {
    const codeVerifier = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(codeVerifier).digest("base64url");
    const stateWithPkce = jwt.sign(
      {
        userId,
        platform: "x-twitter" as const,
        nonce: randomBytes(8).toString("hex"),
        codeVerifier,
      },
      config.jwtSecret,
      { expiresIn: "15m" }
    );
    const params = new URLSearchParams({
      response_type: "code",
      client_id: config.xClientId,
      redirect_uri: redirectUri("x-twitter"),
      scope: "tweet.read tweet.write users.read offline.access",
      state: stateWithPkce,
      code_challenge: challenge,
      code_challenge_method: "S256",
    });
    return `https://twitter.com/i/oauth2/authorize?${params}`;
  }

  if (key === "tiktok") {
    const params = new URLSearchParams({
      client_key: config.tiktokClientKey,
      redirect_uri: redirectUri("tiktok"),
      response_type: "code",
      scope: "user.info.basic,video.publish,video.upload",
      state,
    });
    return `https://www.tiktok.com/v2/auth/authorize/?${params}`;
  }

  throw new Error(`Unsupported OAuth platform: ${platform}`);
}

export async function handleOauthCallback(
  platformKey: string,
  code: string,
  state: string
): Promise<{ redirectUrl: string }> {
  const decoded = jwt.verify(state, config.jwtSecret) as OauthState & { codeVerifier?: string };
  const userId = decoded.userId;

  if (platformKey === "meta") {
    await completeMetaOauth(userId, code);
  } else if (platformKey === "linkedin") {
    await completeLinkedInOauth(userId, code);
  } else if (platformKey === "x-twitter") {
    await completeXOauth(userId, code, decoded.codeVerifier ?? "");
  } else if (platformKey === "tiktok") {
    await completeTikTokOauth(userId, code);
  } else {
    throw new Error(`Unknown OAuth platform: ${platformKey}`);
  }

  return {
    redirectUrl: `${config.frontendUrl}/social?oauth=connected&provider=${encodeURIComponent(platformKey)}`,
  };
}

async function completeMetaOauth(userId: string, code: string) {
  const tokenRes = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?${new URLSearchParams({
      client_id: config.metaAppId,
      client_secret: config.metaAppSecret,
      redirect_uri: redirectUri("meta"),
      code,
    })}`
  );
  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    error?: { message?: string };
  };
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(tokenData.error?.message ?? "Meta token exchange failed");
  }

  // Long-lived user token
  const llRes = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?${new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: config.metaAppId,
      client_secret: config.metaAppSecret,
      fb_exchange_token: tokenData.access_token,
    })}`
  );
  const llData = (await llRes.json()) as { access_token?: string };
  const userToken = llData.access_token ?? tokenData.access_token;

  const meRes = await fetch(
    `https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${encodeURIComponent(userToken)}`
  );
  const me = (await meRes.json()) as { id?: string; name?: string };

  const pagesRes = await fetch(
    `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${encodeURIComponent(userToken)}`
  );
  const pagesData = (await pagesRes.json()) as {
    data?: Array<{
      id: string;
      name: string;
      access_token: string;
      instagram_business_account?: { id: string; username?: string };
    }>;
    error?: { message?: string };
  };
  if (!pagesRes.ok) {
    throw new Error(pagesData.error?.message ?? "Failed to list Meta Pages");
  }

  const pages = pagesData.data ?? [];
  const firstPage = pages[0];

  await upsertWorkspaceIntegration("meta-business", {
    connectionType: "oauth",
    status: "connected",
    accountLabel: me.name ?? "Meta account",
    credentials: {
      accessToken: userToken,
      apiKey: firstPage?.access_token,
    },
    config: {
      userId: me.id,
      pages: pages.map((p) => ({
        id: p.id,
        name: p.name,
        hasInstagram: Boolean(p.instagram_business_account),
        instagramId: p.instagram_business_account?.id,
        instagramUsername: p.instagram_business_account?.username,
      })),
      defaultPageId: firstPage?.id,
      defaultIgUserId: firstPage?.instagram_business_account?.id,
    },
    configuredBy: userId,
  });

  // Mirror FB + IG integrations for publisher lookups
  if (firstPage) {
    await upsertWorkspaceIntegration("facebook", {
      connectionType: "oauth",
      status: "connected",
      accountLabel: firstPage.name,
      credentials: { accessToken: firstPage.access_token },
      config: { pageId: firstPage.id, pageName: firstPage.name },
      configuredBy: userId,
    });

    try {
      await createSocialAccount(userId, {
        platform: "facebook",
        handle: firstPage.name.replace(/\s+/g, "").toLowerCase(),
        displayName: firstPage.name,
        integrationSlug: "facebook",
        config: { pageId: firstPage.id },
      });
    } catch {
      /* duplicate ok */
    }
  }

  const igPage = pages.find((p) => p.instagram_business_account);
  if (igPage?.instagram_business_account) {
    const ig = igPage.instagram_business_account;
    await upsertWorkspaceIntegration("instagram", {
      connectionType: "oauth",
      status: "connected",
      accountLabel: ig.username ?? "Instagram",
      credentials: { accessToken: igPage.access_token },
      config: {
        pageId: igPage.id,
        igUserId: ig.id,
        username: ig.username,
      },
      configuredBy: userId,
    });

    try {
      await createSocialAccount(userId, {
        platform: "instagram",
        handle: (ig.username ?? "instagram").replace(/^@/, ""),
        displayName: ig.username ?? "Instagram",
        integrationSlug: "instagram",
        config: { igUserId: ig.id, pageId: igPage.id },
      });
    } catch {
      /* duplicate ok */
    }
  }
}

async function completeLinkedInOauth(userId: string, code: string) {
  const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri("linkedin"),
      client_id: config.linkedinClientId,
      client_secret: config.linkedinClientSecret,
    }),
  });
  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    error_description?: string;
  };
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(tokenData.error_description ?? "LinkedIn token exchange failed");
  }

  const meRes = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const me = (await meRes.json()) as { sub?: string; name?: string; email?: string };

  await upsertWorkspaceIntegration("linkedin", {
    connectionType: "oauth",
    status: "connected",
    accountLabel: me.name ?? me.email ?? "LinkedIn",
    credentials: {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
    },
    config: { personUrn: me.sub ? `urn:li:person:${me.sub}` : null, name: me.name },
    configuredBy: userId,
  });

  try {
    await createSocialAccount(userId, {
      platform: "linkedin",
      handle: (me.name ?? "linkedin").replace(/\s+/g, "").toLowerCase(),
      displayName: me.name ?? "LinkedIn",
      integrationSlug: "linkedin",
      config: { personUrn: me.sub ? `urn:li:person:${me.sub}` : null },
    });
  } catch {
    /* duplicate ok */
  }
}

async function completeXOauth(userId: string, code: string, codeVerifier: string) {
  if (!codeVerifier) throw new Error("Missing PKCE verifier for X OAuth");

  const basic = Buffer.from(`${config.xClientId}:${config.xClientSecret}`).toString("base64");
  const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri("x-twitter"),
      code_verifier: codeVerifier,
    }),
  });
  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    error_description?: string;
  };
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(tokenData.error_description ?? "X token exchange failed");
  }

  const meRes = await fetch("https://api.twitter.com/2/users/me", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const me = (await meRes.json()) as {
    data?: { id: string; name: string; username: string };
  };

  await upsertWorkspaceIntegration("x-twitter", {
    connectionType: "oauth",
    status: "connected",
    accountLabel: me.data ? `@${me.data.username}` : "X",
    credentials: {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
    },
    config: {
      userId: me.data?.id,
      username: me.data?.username,
      name: me.data?.name,
    },
    configuredBy: userId,
  });

  if (me.data?.username) {
    try {
      await createSocialAccount(userId, {
        platform: "x-twitter",
        handle: me.data.username,
        displayName: me.data.name,
        integrationSlug: "x-twitter",
        config: { userId: me.data.id },
      });
    } catch {
      /* duplicate ok */
    }
  }
}

async function completeTikTokOauth(userId: string, code: string) {
  const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: config.tiktokClientKey,
      client_secret: config.tiktokClientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri("tiktok"),
    }),
  });
  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    open_id?: string;
    error_description?: string;
    error?: string;
  };
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(tokenData.error_description ?? tokenData.error ?? "TikTok token exchange failed");
  }

  await upsertWorkspaceIntegration("tiktok", {
    connectionType: "oauth",
    status: "connected",
    accountLabel: "TikTok",
    credentials: {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
    },
    config: { openId: tokenData.open_id },
    configuredBy: userId,
  });

  try {
    await createSocialAccount(userId, {
      platform: "tiktok",
      handle: tokenData.open_id?.slice(0, 12) ?? "tiktok",
      displayName: "TikTok",
      integrationSlug: "tiktok",
      config: { openId: tokenData.open_id },
    });
  } catch {
    /* duplicate ok */
  }
}
