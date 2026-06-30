import type { IntegrationAdapter, IntegrationContext, ToolActionInput, ToolActionResult } from "./types.js";
import { requireApiKey } from "./credentials.js";

const NOTION_VERSION = "2022-06-28";

function notionHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

async function notionJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { message?: string };
  if (!res.ok) {
    throw new Error((data as { message?: string }).message ?? `Notion API error (${res.status})`);
  }
  return data;
}

function blocksToText(blocks: Array<{ type: string; [key: string]: unknown }>): string {
  const lines: string[] = [];
  for (const block of blocks) {
    const type = block.type;
    const payload = block[type] as { rich_text?: Array<{ plain_text?: string }> } | undefined;
    const text = payload?.rich_text?.map((t) => t.plain_text ?? "").join("") ?? "";
    if (text) lines.push(text);
  }
  return lines.join("\n");
}

export const notionAdapter: IntegrationAdapter = {
  toolSlug: "notion",

  async verify(ctx) {
    const token = requireApiKey(ctx.credentials, "Notion integration token");
    const me = await notionJson<{ name?: string; type?: string }>(
      await fetch("https://api.notion.com/v1/users/me", { headers: notionHeaders(token) })
    );
    return {
      ok: true,
      message: `Connected to Notion as ${me.name ?? me.type ?? "integration"}.`,
      accountLabel: me.name ?? undefined,
    };
  },

  async execute(ctx, input) {
    const token = requireApiKey(ctx.credentials, "Notion integration token");
    const pageId = input.config.pageId || String(ctx.config.pageId ?? "");
    if (!pageId && input.action !== "create") {
      return { ok: false, message: "pageId is required in tool config for Notion read/write." };
    }

    if (input.action === "fetch") {
      const page = await notionJson<{ url?: string; properties?: Record<string, unknown> }>(
        await fetch(`https://api.notion.com/v1/pages/${pageId}`, { headers: notionHeaders(token) })
      );
      const blocks = await notionJson<{ results: Array<{ type: string; [key: string]: unknown }> }>(
        await fetch(`https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`, {
          headers: notionHeaders(token),
        })
      );
      const body = blocksToText(blocks.results);
      return {
        ok: true,
        message: `Fetched Notion page ${pageId}`,
        data: `URL: ${page.url ?? "n/a"}\nProperties: ${JSON.stringify(page.properties ?? {}, null, 2)}\n\n${body}`,
      };
    }

    if (input.action === "write") {
      const content = input.content ?? input.config.content ?? "";
      await notionJson(
        await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
          method: "POST",
          headers: notionHeaders(token),
          body: JSON.stringify({
            children: content.split("\n").filter(Boolean).map((line) => ({
              object: "block",
              type: "paragraph",
              paragraph: {
                rich_text: [{ type: "text", text: { content: line } }],
              },
            })),
          }),
        })
      );
      return { ok: true, message: `Appended ${content.length} characters to Notion page ${pageId}.` };
    }

    if (input.action === "create") {
      const parentDb = input.config.databaseId || String(ctx.config.databaseId ?? "");
      const title = input.config.title || "Tangent document";
      if (!parentDb) {
        return { ok: false, message: "databaseId is required to create a Notion page." };
      }
      const created = await notionJson<{ id: string; url?: string }>(
        await fetch("https://api.notion.com/v1/pages", {
          method: "POST",
          headers: notionHeaders(token),
          body: JSON.stringify({
            parent: { database_id: parentDb },
            properties: {
              Name: { title: [{ text: { content: title } }] },
            },
          }),
        })
      );
      return {
        ok: true,
        message: `Created Notion page "${title}" (${created.id}).`,
        data: JSON.stringify({ pageId: created.id, url: created.url }),
      };
    }

    return { ok: false, message: `Unsupported Notion action: ${input.action}` };
  },
};
