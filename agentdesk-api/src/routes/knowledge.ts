import fs from "fs/promises";
import path from "path";
import { Router } from "express";
import multer from "multer";
import { query } from "../db.js";
import { authRequired, adminRequired, webhookAuth } from "../middleware/auth.js";
import { config } from "../config.js";
import { indexDocument } from "../services/knowledgeIndexer.js";

const router = Router();

const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    const dir = path.resolve(config.uploadDir);
    await fs.mkdir(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".txt", ".md", ".pdf", ".docx", ".csv", ".json"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      cb(new Error(`File type ${ext} not supported. Allowed: ${allowed.join(", ")}`));
      return;
    }
    cb(null, true);
  },
});

router.get("/agent/:slug", authRequired, async (req, res) => {
  const agentResult = await query<{ id: string }>("SELECT id FROM agents WHERE slug = $1", [
    req.params.slug,
  ]);
  const agent = agentResult.rows[0];
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  const result = await query<{
    id: string;
    filename: string;
    file_type: string;
    file_size: number;
    indexed_at: string | null;
    uploaded_at: string;
  }>(
    `SELECT id, filename, file_type, file_size, indexed_at, uploaded_at
     FROM knowledge_documents WHERE agent_id = $1 ORDER BY uploaded_at DESC`,
    [agent.id]
  );

  res.json({
    documents: result.rows.map((d) => ({
      id: d.id,
      filename: d.filename,
      fileType: d.file_type,
      fileSize: d.file_size,
      indexedAt: d.indexed_at,
      uploadedAt: d.uploaded_at,
    })),
  });
});

router.post("/agent/:slug/upload", authRequired, upload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "File is required" });
    return;
  }

  const agentResult = await query<{ id: string; slug: string }>(
    "SELECT id, slug FROM agents WHERE slug = $1",
    [req.params.slug]
  );
  const agent = agentResult.rows[0];
  if (!agent) {
    await fs.unlink(req.file.path).catch(() => undefined);
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  const ext = path.extname(req.file.originalname).toLowerCase();
  const docResult = await query<{ id: string }>(
    `INSERT INTO knowledge_documents (agent_id, filename, file_type, storage_path, file_size, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [
      agent.id,
      req.file.originalname,
      ext.replace(".", ""),
      req.file.path,
      req.file.size,
      req.user!.id,
    ]
  );

  const documentId = docResult.rows[0].id;

  try {
    const chunkCount = await indexDocument(documentId, agent.id, req.file.path, ext);
    await query("UPDATE knowledge_documents SET indexed_at = NOW() WHERE id = $1", [documentId]);

    const indexerUrl = `${config.n8nBaseUrl}/webhook/knowledge-indexer`;
    fetch(indexerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AgentDesk-Secret": config.webhookSecret,
      },
      body: JSON.stringify({
        documentId,
        agentSlug: agent.slug,
        filename: req.file.originalname,
        chunkCount,
      }),
    }).catch(() => undefined);

    res.status(201).json({ documentId, chunkCount, indexed: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Indexing failed";
    res.status(201).json({ documentId, indexed: false, error: message });
  }
});

router.delete("/:documentId", authRequired, adminRequired, async (req, res) => {
  const docResult = await query<{ storage_path: string }>(
    "SELECT storage_path FROM knowledge_documents WHERE id = $1",
    [req.params.documentId]
  );
  const doc = docResult.rows[0];
  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  await query("DELETE FROM knowledge_documents WHERE id = $1", [req.params.documentId]);
  await fs.unlink(doc.storage_path).catch(() => undefined);
  res.json({ deleted: true });
});

router.post("/index", webhookAuth, async (req, res) => {
  const { documentId } = req.body as { documentId?: string };
  if (!documentId) {
    res.status(400).json({ error: "documentId required" });
    return;
  }

  const docResult = await query<{ id: string; agent_id: string; storage_path: string; file_type: string }>(
    "SELECT id, agent_id, storage_path, file_type FROM knowledge_documents WHERE id = $1",
    [documentId]
  );
  const doc = docResult.rows[0];
  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  const ext = `.${doc.file_type}`;
  const chunkCount = await indexDocument(doc.id, doc.agent_id, doc.storage_path, ext);
  await query("UPDATE knowledge_documents SET indexed_at = NOW() WHERE id = $1", [documentId]);
  res.json({ documentId, chunkCount });
});

router.get("/agent/:slug/search", authRequired, async (req, res) => {
  const q = (req.query.q as string) || "";
  const agentResult = await query<{ id: string }>("SELECT id FROM agents WHERE slug = $1", [
    req.params.slug,
  ]);
  const agent = agentResult.rows[0];
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  const { retrieveKnowledgeContext } = await import("../services/knowledgeIndexer.js");
  const context = await retrieveKnowledgeContext(agent.id, q);
  res.json({ context });
});

export default router;
