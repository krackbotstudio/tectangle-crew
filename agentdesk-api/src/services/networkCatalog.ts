import { query } from "../db.js";

export interface NetworkCommunityRow {
  id: string;
  slug: string;
  name: string;
  platform: string;
  url: string;
  description: string | null;
  industries: string[];
  interests: string[];
  product_types: string[];
  audience_size: string | null;
  activity_level: string | null;
  join_type: string;
  owned_social_platform: string | null;
  rules_notes: string | null;
  is_active: boolean;
}

export function mapCommunity(row: NetworkCommunityRow) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    platform: row.platform,
    url: row.url,
    description: row.description,
    industries: row.industries ?? [],
    interests: row.interests ?? [],
    productTypes: row.product_types ?? [],
    audienceSize: row.audience_size,
    activityLevel: row.activity_level,
    joinType: row.join_type,
    ownedSocialPlatform: row.owned_social_platform,
    rulesNotes: row.rules_notes,
    isActive: row.is_active,
  };
}

export async function listNetworkCommunities(filters?: {
  platform?: string;
  q?: string;
}) {
  const params: unknown[] = [];
  let sql = `SELECT * FROM network_communities WHERE is_active = true`;
  if (filters?.platform) {
    params.push(filters.platform);
    sql += ` AND platform = $${params.length}`;
  }
  if (filters?.q?.trim()) {
    params.push(`%${filters.q.trim().toLowerCase()}%`);
    sql += ` AND (
      LOWER(name) LIKE $${params.length}
      OR LOWER(COALESCE(description, '')) LIKE $${params.length}
      OR EXISTS (SELECT 1 FROM unnest(industries) i WHERE LOWER(i) LIKE $${params.length})
      OR EXISTS (SELECT 1 FROM unnest(interests) i WHERE LOWER(i) LIKE $${params.length})
    )`;
  }
  sql += ` ORDER BY name ASC`;
  const result = await query<NetworkCommunityRow>(sql, params);
  return result.rows.map(mapCommunity);
}

export async function getCommunitiesByIds(ids: string[]) {
  if (!ids.length) return [];
  const result = await query<NetworkCommunityRow>(
    `SELECT * FROM network_communities WHERE id = ANY($1::uuid[])`,
    [ids]
  );
  return result.rows.map(mapCommunity);
}

export function scoreCommunityFit(
  community: ReturnType<typeof mapCommunity>,
  profile: {
    industry?: string | null;
    productType?: string | null;
    interests?: string[];
    goals?: string[];
    stage?: string | null;
  }
): { score: number; reasons: string[] } {
  let score = 20;
  const reasons: string[] = [];
  const industry = (profile.industry ?? "").toLowerCase();
  const productType = (profile.productType ?? "").toLowerCase();
  const interests = (profile.interests ?? []).map((i) => i.toLowerCase());

  if (industry && community.industries.some((i) => industry.includes(i.toLowerCase()) || i.toLowerCase().includes(industry))) {
    score += 30;
    reasons.push(`Matches industry (${industry})`);
  }
  if (productType && community.productTypes.some((p) => productType.includes(p.toLowerCase()) || p.toLowerCase().includes(productType))) {
    score += 25;
    reasons.push(`Fits product type (${productType})`);
  }
  const interestHits = community.interests.filter((i) =>
    interests.some((u) => u.includes(i.toLowerCase()) || i.toLowerCase().includes(u))
  );
  if (interestHits.length) {
    score += Math.min(25, interestHits.length * 10);
    reasons.push(`Interest overlap: ${interestHits.slice(0, 3).join(", ")}`);
  }
  if (community.joinType === "owned_social") {
    score += 10;
    reasons.push("Can publish directly via connected Social account");
  }
  if (profile.stage === "first_customers" || profile.goals?.includes("first_customers")) {
    if (/saas|startups|indie|smallbusiness|entrepreneur/i.test(community.slug + community.name)) {
      score += 10;
      reasons.push("Strong for early customer discovery");
    }
  }
  if (profile.stage === "launch" || profile.goals?.includes("launch")) {
    if (/producthunt|indie|saas|x-feed|linkedin/i.test(community.slug)) {
      score += 10;
      reasons.push("Useful for launch visibility");
    }
  }

  return { score: Math.min(100, score), reasons };
}
