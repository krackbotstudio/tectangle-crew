import { query } from "../db.js";

export interface GtmProfileRow {
  id: string;
  user_id: string;
  project_id: string | null;
  product_name: string | null;
  product_type: string | null;
  industry: string | null;
  icp: string | null;
  offer: string | null;
  stage: string;
  goals: string[];
  interests: string[];
  brand_voice: string | null;
  geography: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function mapGtmProfile(row: GtmProfileRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    productName: row.product_name,
    productType: row.product_type,
    industry: row.industry,
    icp: row.icp,
    offer: row.offer,
    stage: row.stage,
    goals: row.goals ?? [],
    interests: row.interests ?? [],
    brandVoice: row.brand_voice,
    geography: row.geography,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getGtmProfile(userId: string, projectId?: string | null) {
  if (projectId) {
    const byProject = await query<GtmProfileRow>(
      `SELECT * FROM network_gtm_profiles WHERE user_id = $1 AND project_id = $2 ORDER BY updated_at DESC LIMIT 1`,
      [userId, projectId]
    );
    if (byProject.rows[0]) return mapGtmProfile(byProject.rows[0]);
  }
  const fallback = await query<GtmProfileRow>(
    `SELECT * FROM network_gtm_profiles WHERE user_id = $1 AND project_id IS NULL ORDER BY updated_at DESC LIMIT 1`,
    [userId]
  );
  return fallback.rows[0] ? mapGtmProfile(fallback.rows[0]) : null;
}

export async function upsertGtmProfile(
  userId: string,
  input: {
    projectId?: string | null;
    productName?: string;
    productType?: string;
    industry?: string;
    icp?: string;
    offer?: string;
    stage?: string;
    goals?: string[];
    interests?: string[];
    brandVoice?: string;
    geography?: string;
    notes?: string;
  }
) {
  const projectId = input.projectId ?? null;
  const existing = projectId
    ? await query<GtmProfileRow>(
        `SELECT * FROM network_gtm_profiles WHERE user_id = $1 AND project_id = $2 ORDER BY updated_at DESC LIMIT 1`,
        [userId, projectId]
      )
    : await query<GtmProfileRow>(
        `SELECT * FROM network_gtm_profiles WHERE user_id = $1 AND project_id IS NULL ORDER BY updated_at DESC LIMIT 1`,
        [userId]
      );

  if (existing.rows[0]) {
    const result = await query<GtmProfileRow>(
      `UPDATE network_gtm_profiles SET
         product_name = COALESCE($3, product_name),
         product_type = COALESCE($4, product_type),
         industry = COALESCE($5, industry),
         icp = COALESCE($6, icp),
         offer = COALESCE($7, offer),
         stage = COALESCE($8, stage),
         goals = COALESCE($9::text[], goals),
         interests = COALESCE($10::text[], interests),
         brand_voice = COALESCE($11, brand_voice),
         geography = COALESCE($12, geography),
         notes = COALESCE($13, notes),
         updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [
        existing.rows[0].id,
        userId,
        input.productName ?? null,
        input.productType ?? null,
        input.industry ?? null,
        input.icp ?? null,
        input.offer ?? null,
        input.stage ?? null,
        input.goals ?? null,
        input.interests ?? null,
        input.brandVoice ?? null,
        input.geography ?? null,
        input.notes ?? null,
      ]
    );
    return mapGtmProfile(result.rows[0]);
  }

  const result = await query<GtmProfileRow>(
    `INSERT INTO network_gtm_profiles
       (user_id, project_id, product_name, product_type, industry, icp, offer, stage, goals, interests, brand_voice, geography, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8,'launch'),COALESCE($9::text[],'{}'),COALESCE($10::text[],'{}'),$11,$12,$13)
     RETURNING *`,
    [
      userId,
      input.projectId ?? null,
      input.productName ?? null,
      input.productType ?? null,
      input.industry ?? null,
      input.icp ?? null,
      input.offer ?? null,
      input.stage ?? null,
      input.goals ?? null,
      input.interests ?? null,
      input.brandVoice ?? null,
      input.geography ?? null,
      input.notes ?? null,
    ]
  );
  return mapGtmProfile(result.rows[0]);
}

export function formatGtmBrief(profile: ReturnType<typeof mapGtmProfile>): string {
  return [
    profile.productName && `Product: ${profile.productName}`,
    profile.productType && `Type: ${profile.productType}`,
    profile.industry && `Industry: ${profile.industry}`,
    profile.icp && `ICP: ${profile.icp}`,
    profile.offer && `Offer: ${profile.offer}`,
    profile.stage && `Stage: ${profile.stage}`,
    profile.goals.length && `Goals: ${profile.goals.join(", ")}`,
    profile.interests.length && `Interests: ${profile.interests.join(", ")}`,
    profile.brandVoice && `Voice: ${profile.brandVoice}`,
    profile.geography && `Geo: ${profile.geography}`,
    profile.notes && `Notes: ${profile.notes}`,
  ]
    .filter(Boolean)
    .join("\n");
}
