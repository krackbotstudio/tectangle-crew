import { Router } from "express";
import { query } from "../db.js";
import { authRequired } from "../middleware/auth.js";

const router = Router({ mergeParams: true });

type BoardRow = {
  id: string;
  agent_id: string;
  column_side: "input" | "output";
  card_type: string;
  title: string;
  description: string | null;
  config: Record<string, unknown>;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

function mapCard(row: BoardRow) {
  return {
    id: row.id,
    agentId: row.agent_id,
    columnSide: row.column_side,
    cardType: row.card_type,
    title: row.title,
    description: row.description,
    config: row.config ?? {},
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getAgentIdBySlug(slug: string): Promise<string | null> {
  const result = await query<{ id: string }>("SELECT id FROM agents WHERE slug = $1", [slug]);
  return result.rows[0]?.id ?? null;
}

async function seedDefaultCards(agentId: string) {
  const agent = await query<{
    skills: string[];
    rules: string[];
    constraints: string[];
  }>("SELECT skills, rules, constraints FROM agents WHERE id = $1", [agentId]);
  const row = agent.rows[0];
  if (!row) return;

  const defaults: {
    column_side: "input" | "output";
    card_type: string;
    title: string;
    description: string;
    config: Record<string, unknown>;
    sort_order: number;
  }[] = [
    {
      column_side: "input",
      card_type: "knowledge",
      title: "Knowledge base",
      description: "Documents and reference material for this agent",
      config: {},
      sort_order: 0,
    },
    {
      column_side: "input",
      card_type: "skills",
      title: "Skills",
      description: "Capabilities this agent can perform",
      config: { items: row.skills ?? [] },
      sort_order: 1,
    },
    {
      column_side: "input",
      card_type: "notes",
      title: "Notes",
      description: "Internal notes and context for the agent",
      config: { content: "" },
      sort_order: 2,
    },
    {
      column_side: "input",
      card_type: "drive_link",
      title: "Drive & links",
      description: "Google Drive folders and URLs to pull skills from",
      config: { links: [] },
      sort_order: 3,
    },
    {
      column_side: "input",
      card_type: "file",
      title: "Attached files",
      description: "Files attached as skill sources",
      config: { files: [] },
      sort_order: 4,
    },
    {
      column_side: "input",
      card_type: "rules",
      title: "Rules",
      description: "Behavior rules the agent must follow",
      config: { items: row.rules ?? [] },
      sort_order: 5,
    },
    {
      column_side: "output",
      card_type: "output_route",
      title: "Copy & content",
      description: "Where to store written content",
      config: {
        contentType: "copy",
        destinations: [
          { provider: "google_docs", label: "Google Docs" },
          { provider: "notes", label: "Notes" },
          { provider: "markdown", label: "Markdown (.md)" },
        ],
      },
      sort_order: 0,
    },
    {
      column_side: "output",
      card_type: "output_route",
      title: "Presentations",
      description: "Where to store slide decks",
      config: {
        contentType: "presentation",
        destinations: [
          { provider: "google_slides", label: "Google Slides" },
          { provider: "powerpoint", label: "PowerPoint" },
          { provider: "canva", label: "Canva" },
        ],
      },
      sort_order: 1,
    },
    {
      column_side: "output",
      card_type: "output_route",
      title: "Design assets",
      description: "Where to store visual design outputs",
      config: {
        contentType: "design",
        destinations: [
          { provider: "canva", label: "Canva" },
          { provider: "figma", label: "Figma" },
          { provider: "drive", label: "Google Drive" },
        ],
      },
      sort_order: 2,
    },
  ];

  for (const card of defaults) {
    await query(
      `INSERT INTO agent_board_cards (agent_id, column_side, card_type, title, description, config, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
      [
        agentId,
        card.column_side,
        card.card_type,
        card.title,
        card.description,
        JSON.stringify(card.config),
        card.sort_order,
      ]
    );
  }
}

async function syncSkillsFromBoard(agentId: string) {
  const skillsCard = await query<{ config: { items?: string[] } }>(
    `SELECT config FROM agent_board_cards
     WHERE agent_id = $1 AND card_type = 'skills' LIMIT 1`,
    [agentId]
  );
  const items = skillsCard.rows[0]?.config?.items;
  if (!Array.isArray(items)) return;

  await query(`UPDATE agents SET skills = $2::jsonb, updated_at = NOW() WHERE id = $1`, [
    agentId,
    JSON.stringify(items),
  ]);
}

async function syncRulesFromBoard(agentId: string) {
  const rulesCard = await query<{ config: { items?: string[] } }>(
    `SELECT config FROM agent_board_cards
     WHERE agent_id = $1 AND card_type = 'rules' LIMIT 1`,
    [agentId]
  );
  const items = rulesCard.rows[0]?.config?.items;
  if (!Array.isArray(items)) return;

  await query(`UPDATE agents SET rules = $2::jsonb, updated_at = NOW() WHERE id = $1`, [
    agentId,
    JSON.stringify(items),
  ]);
}

router.get("/", authRequired, async (req, res) => {
  const agentId = await getAgentIdBySlug(req.params.slug);
  if (!agentId) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  let result = await query<BoardRow>(
    `SELECT * FROM agent_board_cards WHERE agent_id = $1 ORDER BY column_side, sort_order, created_at`,
    [agentId]
  );

  if (result.rows.length === 0) {
    await seedDefaultCards(agentId);
    result = await query<BoardRow>(
      `SELECT * FROM agent_board_cards WHERE agent_id = $1 ORDER BY column_side, sort_order, created_at`,
      [agentId]
    );
  }

  res.json({ cards: result.rows.map(mapCard) });
});

router.post("/cards", authRequired, async (req, res) => {
  const agentId = await getAgentIdBySlug(req.params.slug);
  if (!agentId) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  const { columnSide, cardType, title, description, config, sortOrder } = req.body as {
    columnSide?: "input" | "output";
    cardType?: string;
    title?: string;
    description?: string;
    config?: Record<string, unknown>;
    sortOrder?: number;
  };

  if (!columnSide || !cardType || !title?.trim()) {
    res.status(400).json({ error: "columnSide, cardType, and title are required" });
    return;
  }

  const inserted = await query<BoardRow>(
    `INSERT INTO agent_board_cards (agent_id, column_side, card_type, title, description, config, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, COALESCE($7, 0))
     RETURNING *`,
    [
      agentId,
      columnSide,
      cardType,
      title.trim(),
      description ?? null,
      JSON.stringify(config ?? {}),
      sortOrder ?? 0,
    ]
  );

  res.status(201).json({ card: mapCard(inserted.rows[0]) });
});

router.patch("/cards/:cardId", authRequired, async (req, res) => {
  const agentId = await getAgentIdBySlug(req.params.slug);
  if (!agentId) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  const { title, description, config, sortOrder } = req.body as {
    title?: string;
    description?: string;
    config?: Record<string, unknown>;
    sortOrder?: number;
  };

  const existing = await query<{ card_type: string }>(
    `SELECT card_type FROM agent_board_cards WHERE id = $1 AND agent_id = $2`,
    [req.params.cardId, agentId]
  );
  if (!existing.rows[0]) {
    res.status(404).json({ error: "Card not found" });
    return;
  }

  const sets: string[] = ["updated_at = NOW()"];
  const params: unknown[] = [req.params.cardId, agentId];
  let n = 3;

  if (title !== undefined) {
    sets.push(`title = $${n++}`);
    params.push(title.trim());
  }
  if (description !== undefined) {
    sets.push(`description = $${n++}`);
    params.push(description);
  }
  if (config !== undefined) {
    sets.push(`config = $${n++}::jsonb`);
    params.push(JSON.stringify(config));
  }
  if (sortOrder !== undefined) {
    sets.push(`sort_order = $${n++}`);
    params.push(sortOrder);
  }

  const updated = await query<BoardRow>(
    `UPDATE agent_board_cards SET ${sets.join(", ")}
     WHERE id = $1 AND agent_id = $2 RETURNING *`,
    params
  );

  const cardType = existing.rows[0].card_type;
  if (cardType === "skills") await syncSkillsFromBoard(agentId);
  if (cardType === "rules") await syncRulesFromBoard(agentId);

  res.json({ card: mapCard(updated.rows[0]) });
});

router.delete("/cards/:cardId", authRequired, async (req, res) => {
  const agentId = await getAgentIdBySlug(req.params.slug);
  if (!agentId) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  const deleted = await query(
    `DELETE FROM agent_board_cards WHERE id = $1 AND agent_id = $2 RETURNING id`,
    [req.params.cardId, agentId]
  );

  if (!deleted.rows[0]) {
    res.status(404).json({ error: "Card not found" });
    return;
  }

  res.json({ deleted: true });
});

export default router;
