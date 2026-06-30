import type { IntegrationAdapter } from "./types.js";
import { requireApiKey } from "./credentials.js";

function bufferToken(ctx: Parameters<IntegrationAdapter["verify"]>[0]) {
  return (
    ctx.credentials.accessToken?.trim() ||
    requireApiKey(ctx.credentials, "Buffer access token")
  );
}

export const bufferAdapter: IntegrationAdapter = {
  toolSlug: "buffer",

  async verify(ctx) {
    const token = bufferToken(ctx);
    const res = await fetch(`https://api.bufferapp.com/1/user.json?access_token=${encodeURIComponent(token)}`);
    const data = (await res.json()) as { success?: boolean; name?: string; message?: string };
    if (!res.ok || data.success === false) {
      throw new Error(data.message ?? `Buffer API error (${res.status})`);
    }
    return {
      ok: true,
      message: `Connected to Buffer as ${data.name ?? "user"}.`,
      accountLabel: data.name,
    };
  },

  async execute(ctx, input) {
    const token = bufferToken(ctx);
    const profileId = input.config.profileId || String(ctx.config.profileId ?? "");

    if (input.action === "fetch") {
      const res = await fetch(
        `https://api.bufferapp.com/1/profiles.json?access_token=${encodeURIComponent(token)}`
      );
      const data = (await res.json()) as Array<{ id: string; service: string; formatted_username?: string }>;
      if (!res.ok) {
        return { ok: false, message: "Failed to list Buffer profiles" };
      }
      const lines = data.map((p) => `${p.id}: ${p.service} — ${p.formatted_username ?? ""}`);
      return { ok: true, message: "Listed Buffer profiles.", data: lines.join("\n") };
    }

    if (input.action === "write" || input.action === "create") {
      const content = input.content ?? input.config.content ?? "";
      if (!profileId) {
        return { ok: false, message: "profileId is required. Run fetch first to list profile IDs." };
      }
      const body = new URLSearchParams({
        access_token: token,
        text: content,
        profile_ids: profileId,
      });
      const res = await fetch("https://api.bufferapp.com/1/updates/create.json", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      const data = (await res.json()) as { success?: boolean; message?: string; updates?: Array<{ id: string }> };
      if (!res.ok || data.success === false) {
        return { ok: false, message: data.message ?? "Buffer queue failed" };
      }
      return {
        ok: true,
        message: `Queued post to Buffer profile ${profileId}.`,
        data: JSON.stringify({ updateIds: data.updates?.map((u) => u.id) }),
      };
    }

    return { ok: false, message: `Unsupported Buffer action: ${input.action}` };
  },
};
