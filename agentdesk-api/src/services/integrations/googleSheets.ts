import type { IntegrationAdapter } from "./types.js";
import { getGoogleAccessToken, parseServiceAccount } from "./googleAuth.js";

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

async function sheetsToken(ctx: Parameters<IntegrationAdapter["verify"]>[0]) {
  const sa = parseServiceAccount(ctx.credentials);
  return getGoogleAccessToken(sa, [SHEETS_SCOPE]);
}

function spreadsheetId(ctx: Parameters<IntegrationAdapter["verify"]>[0], config: Record<string, string>) {
  const id = config.spreadsheetId || String(ctx.config.spreadsheetId ?? "");
  if (!id) throw new Error("spreadsheetId is required. Set it in App Store or project tool config.");
  return id;
}

export const googleSheetsAdapter: IntegrationAdapter = {
  toolSlug: "google-sheets",

  async verify(ctx) {
    const token = await sheetsToken(ctx);
    const id = String(ctx.config.spreadsheetId ?? "").trim();
    if (!id) {
      return {
        ok: true,
        message:
          "Google service account authenticated. Share your spreadsheet with the service account email and add spreadsheetId below.",
      };
    }
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}?fields=properties.title`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await res.json()) as { properties?: { title?: string }; error?: { message?: string } };
    if (!res.ok) {
      throw new Error(data.error?.message ?? `Google Sheets error (${res.status})`);
    }
    return {
      ok: true,
      message: `Connected to spreadsheet "${data.properties?.title ?? id}".`,
      accountLabel: data.properties?.title,
    };
  },

  async execute(ctx, input) {
    const token = await sheetsToken(ctx);
    const range = input.config.range || "Sheet1!A1:Z1000";

    if (input.action === "create") {
      const title = input.config.title || "Tangent spreadsheet";
      const res = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ properties: { title } }),
      });
      const data = (await res.json()) as { spreadsheetId?: string; spreadsheetUrl?: string; error?: { message?: string } };
      if (!res.ok || !data.spreadsheetId) {
        return { ok: false, message: data.error?.message ?? "Failed to create spreadsheet" };
      }
      return {
        ok: true,
        message: `Created spreadsheet "${title}".`,
        data: JSON.stringify({ spreadsheetId: data.spreadsheetId, url: data.spreadsheetUrl }),
      };
    }

    const id = spreadsheetId(ctx, input.config);

    if (input.action === "fetch") {
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(range)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = (await res.json()) as { values?: string[][]; error?: { message?: string } };
      if (!res.ok) {
        return { ok: false, message: data.error?.message ?? `Fetch failed (${res.status})` };
      }
      const rows = data.values ?? [];
      const text = rows.map((row) => row.join("\t")).join("\n");
      return { ok: true, message: `Fetched ${rows.length} rows from ${id}.`, data: text };
    }

    if (input.action === "write") {
      const content = input.content ?? input.config.content ?? "";
      const lines = content.split("\n").filter((l) => l.trim());
      const values = lines.map((line) => line.split("\t"));
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ values }),
        }
      );
      const data = (await res.json()) as { updatedCells?: number; error?: { message?: string } };
      if (!res.ok) {
        return { ok: false, message: data.error?.message ?? `Write failed (${res.status})` };
      }
      return {
        ok: true,
        message: `Wrote ${data.updatedCells ?? values.length} cells to ${id} (${range}).`,
      };
    }

    return { ok: false, message: `Unsupported action: ${input.action}` };
  },
};
