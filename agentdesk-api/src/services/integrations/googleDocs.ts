import type { IntegrationAdapter } from "./types.js";
import { getGoogleAccessToken, parseServiceAccount } from "./googleAuth.js";

const DOCS_SCOPE = "https://www.googleapis.com/auth/documents";

async function docsToken(ctx: Parameters<IntegrationAdapter["verify"]>[0]) {
  const sa = parseServiceAccount(ctx.credentials);
  return getGoogleAccessToken(sa, [DOCS_SCOPE]);
}

function docId(ctx: Parameters<IntegrationAdapter["verify"]>[0], config: Record<string, string>) {
  const id = config.docId || String(ctx.config.docId ?? "");
  if (!id) throw new Error("docId is required. Set it in App Store or project tool config.");
  return id;
}

function docPlainText(body: { content?: Array<{ paragraph?: { elements?: Array<{ textRun?: { content?: string } }> } }> }) {
  const parts: string[] = [];
  for (const el of body.content ?? []) {
    for (const run of el.paragraph?.elements ?? []) {
      if (run.textRun?.content) parts.push(run.textRun.content);
    }
  }
  return parts.join("");
}

export const googleDocsAdapter: IntegrationAdapter = {
  toolSlug: "google-docs",

  async verify(ctx) {
    const token = await docsToken(ctx);
    const id = String(ctx.config.docId ?? "").trim();
    if (!id) {
      return {
        ok: true,
        message:
          "Google service account authenticated. Share your document with the service account email and add docId below.",
      };
    }
    const res = await fetch(`https://docs.googleapis.com/v1/documents/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await res.json()) as { title?: string; error?: { message?: string } };
    if (!res.ok) {
      throw new Error(data.error?.message ?? `Google Docs error (${res.status})`);
    }
    return {
      ok: true,
      message: `Connected to document "${data.title ?? id}".`,
      accountLabel: data.title,
    };
  },

  async execute(ctx, input) {
    const token = await docsToken(ctx);

    if (input.action === "create") {
      const title = input.config.title || "Tangent document";
      const res = await fetch("https://docs.googleapis.com/v1/documents", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title }),
      });
      const data = (await res.json()) as { documentId?: string; title?: string; error?: { message?: string } };
      if (!res.ok || !data.documentId) {
        return { ok: false, message: data.error?.message ?? "Failed to create document" };
      }
      return {
        ok: true,
        message: `Created document "${data.title ?? title}".`,
        data: JSON.stringify({ docId: data.documentId }),
      };
    }

    const id = docId(ctx, input.config);

    if (input.action === "fetch") {
      const res = await fetch(`https://docs.googleapis.com/v1/documents/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as {
        title?: string;
        body?: { content?: Array<{ paragraph?: { elements?: Array<{ textRun?: { content?: string } }> } }> };
        error?: { message?: string };
      };
      if (!res.ok) {
        return { ok: false, message: data.error?.message ?? `Fetch failed (${res.status})` };
      }
      const text = docPlainText(data.body ?? {});
      return {
        ok: true,
        message: `Fetched document "${data.title ?? id}".`,
        data: `Title: ${data.title ?? id}\n\n${text}`,
      };
    }

    if (input.action === "write") {
      const content = input.content ?? input.config.content ?? "";
      const docRes = await fetch(`https://docs.googleapis.com/v1/documents/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const doc = (await docRes.json()) as {
        body?: { content?: Array<{ endIndex?: number }> };
        error?: { message?: string };
      };
      if (!docRes.ok) {
        return { ok: false, message: doc.error?.message ?? "Could not load document for write" };
      }
      const endIndex = doc.body?.content?.at(-1)?.endIndex ?? 1;
      const insertIndex = Math.max(1, endIndex - 1);

      const res = await fetch(`https://docs.googleapis.com/v1/documents/${id}:batchUpdate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requests: [
            {
              insertText: {
                location: { index: insertIndex },
                text: content.endsWith("\n") ? content : `${content}\n`,
              },
            },
          ],
        }),
      });
      const data = (await res.json()) as { error?: { message?: string } };
      if (!res.ok) {
        return { ok: false, message: data.error?.message ?? `Write failed (${res.status})` };
      }
      return { ok: true, message: `Appended ${content.length} characters to document ${id}.` };
    }

    return { ok: false, message: `Unsupported action: ${input.action}` };
  },
};
