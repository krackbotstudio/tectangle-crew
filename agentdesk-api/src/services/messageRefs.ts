import { query } from "../db.js";

/** Expand #msg-abc12345 tokens into quoted context for the LLM. */
export async function expandMessageReferences(
  message: string,
  projectId: string | null,
  userId: string
): Promise<string> {
  const refRegex = /#msg-([a-f0-9]{6,8})\b/gi;
  let expanded = message;
  const seen = new Set<string>();

  for (const match of message.matchAll(refRegex)) {
    const token = match[0];
    const prefix = match[1].toLowerCase();
    if (seen.has(token.toLowerCase())) continue;
    seen.add(token.toLowerCase());

    let row: { role: string; content: string } | undefined;

    if (projectId) {
      const result = await query<{ role: string; content: string }>(
        `SELECT role, content FROM chat_messages
         WHERE project_id = $1 AND LOWER(REPLACE(id::text, '-', '')) LIKE $2 || '%'
         ORDER BY created_at DESC LIMIT 1`,
        [projectId, prefix]
      );
      row = result.rows[0];
    } else {
      const result = await query<{ role: string; content: string }>(
        `SELECT role, content FROM chat_messages
         WHERE project_id IS NULL AND user_id = $2
           AND LOWER(REPLACE(id::text, '-', '')) LIKE $1 || '%'
         ORDER BY created_at DESC LIMIT 1`,
        [prefix, userId]
      );
      row = result.rows[0];
    }

    if (!row) continue;

    const snippet = row.content.replace(/\s+/g, " ").trim().slice(0, 400);
    const quote = `[Referenced ${row.role} message #msg-${prefix}: "${snippet}${row.content.length > 400 ? "…" : ""}"]`;
    expanded = expanded.replace(new RegExp(escapeRegExp(token), "gi"), `${token} ${quote}`);
  }

  return expanded;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function messageRefToken(messageId: string): string {
  const compact = messageId.replace(/-/g, "").slice(0, 8).toLowerCase();
  return `#msg-${compact}`;
}
