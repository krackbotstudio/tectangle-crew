import type { IntegrationAdapter } from "./types.js";
import { requireApiKey } from "./credentials.js";

export const slackAdapter: IntegrationAdapter = {
  toolSlug: "slack",

  async verify(ctx) {
    const token = requireApiKey(ctx.credentials, "Slack bot token");
    const res = await fetch("https://slack.com/api/auth.test", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await res.json()) as { ok: boolean; team?: string; user?: string; error?: string };
    if (!data.ok) {
      throw new Error(data.error ?? "Slack auth failed");
    }
    return {
      ok: true,
      message: `Connected to Slack workspace "${data.team ?? "unknown"}".`,
      accountLabel: data.team,
    };
  },

  async execute(ctx, input) {
    const token = requireApiKey(ctx.credentials, "Slack bot token");
    const channel = input.config.channel || String(ctx.config.channel ?? "");
    if (!channel) {
      return { ok: false, message: "channel is required (e.g. #marketing or channel ID)." };
    }

    if (input.action === "fetch") {
      const res = await fetch(
        `https://slack.com/api/conversations.history?channel=${encodeURIComponent(channel)}&limit=20`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = (await res.json()) as {
        ok: boolean;
        messages?: Array<{ user?: string; text?: string }>;
        error?: string;
      };
      if (!data.ok) {
        return { ok: false, message: data.error ?? "Failed to read channel history" };
      }
      const text = (data.messages ?? [])
        .map((m) => m.text ?? "")
        .filter(Boolean)
        .reverse()
        .join("\n");
      return { ok: true, message: `Fetched recent messages from ${channel}.`, data: text };
    }

    if (input.action === "write") {
      const content = input.content ?? input.config.content ?? "";
      const res = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ channel, text: content }),
      });
      const data = (await res.json()) as { ok: boolean; ts?: string; error?: string };
      if (!data.ok) {
        return { ok: false, message: data.error ?? "Failed to post message" };
      }
      return { ok: true, message: `Posted message to ${channel} (ts ${data.ts}).` };
    }

    return { ok: false, message: "Slack create is not supported; use write to post a message." };
  },
};
