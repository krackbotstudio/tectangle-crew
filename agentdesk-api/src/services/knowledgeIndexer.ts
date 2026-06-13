import fs from "fs/promises";
import { query } from "../db.js";

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;

async function readFileText(filePath: string, ext: string): Promise<string> {
  if (ext === ".txt" || ext === ".md" || ext === ".csv" || ext === ".json") {
    return fs.readFile(filePath, "utf-8");
  }

  if (ext === ".pdf" || ext === ".docx") {
    return fs.readFile(filePath, "utf-8").catch(() => {
      throw new Error(
        `Binary ${ext} files need text extraction. For now, upload .txt or .md files, or add a parser later.`
      );
    });
  }

  throw new Error(`Unsupported file type: ${ext}`);
}

function chunkText(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length) {
    const end = Math.min(start + CHUNK_SIZE, normalized.length);
    chunks.push(normalized.slice(start, end));
    if (end >= normalized.length) break;
    start = end - CHUNK_OVERLAP;
  }
  return chunks;
}

export async function indexDocument(
  documentId: string,
  agentId: string,
  filePath: string,
  ext: string
): Promise<number> {
  const text = await readFileText(filePath, ext);
  const chunks = chunkText(text);

  await query("DELETE FROM knowledge_chunks WHERE document_id = $1", [documentId]);

  for (let i = 0; i < chunks.length; i++) {
    await query(
      `INSERT INTO knowledge_chunks (document_id, agent_id, chunk_index, content)
       VALUES ($1, $2, $3, $4)`,
      [documentId, agentId, i, chunks[i]]
    );
  }

  return chunks.length;
}

export async function retrieveKnowledgeContext(
  agentId: string,
  queryText: string,
  limit = 5
): Promise<string> {
  const terms = queryText
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 3)
    .slice(0, 8);

  if (terms.length === 0) {
    const fallback = await query<{ content: string }>(
      `SELECT content FROM knowledge_chunks WHERE agent_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [agentId, limit]
    );
    return fallback.rows.map((r, i) => `[${i + 1}] ${r.content}`).join("\n\n");
  }

  const patterns = terms.map((t) => `%${t}%`);
  const conditions = patterns.map((_, i) => `LOWER(content) LIKE $${i + 2}`).join(" OR ");

  const result = await query<{ content: string; chunk_index: number }>(
    `SELECT content, chunk_index FROM knowledge_chunks
     WHERE agent_id = $1 AND (${conditions})
     ORDER BY chunk_index ASC
     LIMIT $${patterns.length + 2}`,
    [agentId, ...patterns, limit]
  );

  if (result.rows.length === 0) {
    const fallback = await query<{ content: string }>(
      `SELECT content FROM knowledge_chunks WHERE agent_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [agentId, limit]
    );
    return fallback.rows.map((r, i) => `[${i + 1}] ${r.content}`).join("\n\n");
  }

  return result.rows.map((r, i) => `[${i + 1}] ${r.content}`).join("\n\n");
}
