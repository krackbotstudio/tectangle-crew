import { query } from "../db.js";
import { createSocialPost } from "./socialPosts.js";
import { getCommunitiesByIds, mapCommunity } from "./networkCatalog.js";
import type { CollateralPack } from "./networkAi.js";
import { resolveCreativeIdForCommunity, type CreativeMode } from "./networkCreatives.js";

export interface CampaignRow {
  id: string;
  user_id: string;
  project_id: string | null;
  gtm_profile_id: string | null;
  title: string;
  goal: string | null;
  status: string;
  brief: string | null;
  collateral: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface JobRow {
  id: string;
  campaign_id: string;
  community_id: string | null;
  channel_type: string;
  platform: string;
  destination_label: string | null;
  destination_url: string | null;
  content: string;
  collateral_type: string;
  status: string;
  social_post_id: string | null;
  creative_id: string | null;
  external_ref: string | null;
  error_detail: string | null;
  outcome: string | null;
  published_at: string | null;
  completed_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  community_name?: string;
  creative_file_name?: string | null;
}

export function mapCampaign(row: CampaignRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    gtmProfileId: row.gtm_profile_id,
    title: row.title,
    goal: row.goal,
    status: row.status,
    brief: row.brief,
    collateral: row.collateral ?? {},
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapJob(row: JobRow) {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    communityId: row.community_id,
    communityName: row.community_name ?? null,
    channelType: row.channel_type,
    platform: row.platform,
    destinationLabel: row.destination_label,
    destinationUrl: row.destination_url,
    content: row.content,
    collateralType: row.collateral_type,
    status: row.status,
    socialPostId: row.social_post_id,
    creativeId: row.creative_id ?? null,
    creativeDownloadUrl: row.creative_file_name
      ? `/creatives/files/${row.creative_file_name}`
      : null,
    externalRef: row.external_ref,
    errorDetail: row.error_detail,
    outcome: row.outcome,
    publishedAt: row.published_at,
    completedAt: row.completed_at,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function contentForCommunity(
  community: ReturnType<typeof mapCommunity>,
  pack: CollateralPack
): { content: string; collateralType: string } {
  if (community.ownedSocialPlatform === "linkedin") {
    return { content: pack.linkedinPost, collateralType: "post" };
  }
  if (community.ownedSocialPlatform === "x-twitter") {
    return { content: pack.xPost, collateralType: "post" };
  }
  if (community.joinType === "owned_social") {
    return { content: pack.launchPost, collateralType: "post" };
  }
  if (/producthunt|waitlist|upcoming/i.test(community.slug)) {
    return { content: pack.waitlistCta, collateralType: "waitlist" };
  }
  return { content: pack.launchPost, collateralType: "launch" };
}

export async function listCampaigns(userId: string) {
  const result = await query<CampaignRow>(
    `SELECT * FROM network_campaigns WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 50`,
    [userId]
  );
  return result.rows.map(mapCampaign);
}

export async function getCampaign(userId: string, campaignId: string) {
  const result = await query<CampaignRow>(
    `SELECT * FROM network_campaigns WHERE id = $1 AND user_id = $2`,
    [campaignId, userId]
  );
  return result.rows[0] ? mapCampaign(result.rows[0]) : null;
}

export async function listCampaignJobs(userId: string, campaignId: string) {
  const result = await query<JobRow>(
    `SELECT j.*, c.name AS community_name, ac.file_name AS creative_file_name
     FROM network_campaign_jobs j
     JOIN network_campaigns camp ON camp.id = j.campaign_id
     LEFT JOIN network_communities c ON c.id = j.community_id
     LEFT JOIN agent_creatives ac ON ac.id = j.creative_id
     WHERE j.campaign_id = $1 AND camp.user_id = $2
     ORDER BY j.created_at ASC`,
    [campaignId, userId]
  );
  return result.rows.map(mapJob);
}

export async function createCampaignWithJobs(input: {
  userId: string;
  projectId?: string | null;
  gtmProfileId?: string | null;
  title: string;
  goal?: string;
  brief?: string;
  communityIds: string[];
  collateral: CollateralPack;
  publishOwnedNow?: boolean;
  creativeMode?: CreativeMode | "none";
  sharedCreativeId?: string | null;
  creatives?: { communityId?: string | null; creativeId: string }[];
}) {
  const campaignInsert = await query<CampaignRow>(
    `INSERT INTO network_campaigns
       (user_id, project_id, gtm_profile_id, title, goal, status, brief, collateral, metadata)
     VALUES ($1,$2,$3,$4,$5,'ready',$6,$7::jsonb,$8::jsonb)
     RETURNING *`,
    [
      input.userId,
      input.projectId ?? null,
      input.gtmProfileId ?? null,
      input.title,
      input.goal ?? null,
      input.brief ?? null,
      JSON.stringify({
        ...input.collateral,
        creativeMode: input.creativeMode ?? "none",
        creatives: input.creatives ?? [],
        sharedCreativeId: input.sharedCreativeId ?? null,
      }),
      JSON.stringify({
        creativeMode: input.creativeMode ?? "none",
        sharedCreativeId: input.sharedCreativeId ?? null,
      }),
    ]
  );
  const campaign = mapCampaign(campaignInsert.rows[0]);
  const communities = await getCommunitiesByIds(input.communityIds);

  const jobs = [];
  for (const community of communities) {
    const { content, collateralType } = contentForCommunity(community, input.collateral);
    const channelType =
      community.joinType === "owned_social"
        ? "owned_social"
        : community.joinType === "integrated"
          ? "integrated"
          : "assisted_community";

    const creativeId = resolveCreativeIdForCommunity(
      community.id,
      input.creativeMode,
      input.creatives,
      input.sharedCreativeId
    );

    let status = channelType === "owned_social" ? "queued" : "assisted_pending";
    let socialPostId: string | null = null;
    let errorDetail: string | null = null;
    let publishedAt: string | null = null;
    let externalRef: string | null = null;

    if (channelType === "owned_social" && community.ownedSocialPlatform && input.publishOwnedNow) {
      try {
        const published = await createSocialPost(input.userId, {
          platform: community.ownedSocialPlatform,
          content,
          projectId: input.projectId ?? undefined,
          creativeId: creativeId ?? undefined,
          publishNow: true,
        });
        socialPostId = published.post.id;
        if (published.post.status === "published") {
          status = "published";
          publishedAt = published.post.publishedAt;
          externalRef = published.post.externalPostId;
        } else if (published.post.status === "failed") {
          status = "failed";
          errorDetail = published.post.errorDetail ?? published.message;
        } else {
          status = "ready";
        }
      } catch (error) {
        status = "failed";
        errorDetail = (error as Error).message;
      }
    } else if (channelType === "owned_social" && community.ownedSocialPlatform && !input.publishOwnedNow) {
      try {
        const drafted = await createSocialPost(input.userId, {
          platform: community.ownedSocialPlatform,
          content,
          projectId: input.projectId ?? undefined,
          creativeId: creativeId ?? undefined,
          publishNow: false,
        });
        socialPostId = drafted.post.id;
        status = "ready";
      } catch (error) {
        status = "failed";
        errorDetail = (error as Error).message;
      }
    }

    const jobInsert = await query<JobRow>(
      `INSERT INTO network_campaign_jobs
         (campaign_id, community_id, channel_type, platform, destination_label, destination_url,
          content, collateral_type, status, social_post_id, creative_id, external_ref, error_detail, published_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::timestamptz)
       RETURNING *`,
      [
        campaign.id,
        community.id,
        channelType,
        community.ownedSocialPlatform ?? community.platform,
        community.name,
        community.url,
        content,
        collateralType,
        status,
        socialPostId,
        creativeId,
        externalRef,
        errorDetail,
        publishedAt,
      ]
    );
    jobs.push(mapJob({ ...jobInsert.rows[0], community_name: community.name }));
  }

  await query(
    `UPDATE network_campaigns SET status = $2, updated_at = NOW() WHERE id = $1`,
    [campaign.id, input.publishOwnedNow ? "running" : "ready"]
  );

  return { campaign: { ...campaign, status: input.publishOwnedNow ? "running" : "ready" }, jobs };
}

export async function updateJobStatus(
  userId: string,
  jobId: string,
  input: { status?: string; outcome?: string; notes?: string }
) {
  const owned = await query<{ id: string }>(
    `SELECT j.id FROM network_campaign_jobs j
     JOIN network_campaigns c ON c.id = j.campaign_id
     WHERE j.id = $1 AND c.user_id = $2`,
    [jobId, userId]
  );
  if (!owned.rows[0]) return null;

  const result = await query<JobRow>(
    `UPDATE network_campaign_jobs SET
       status = COALESCE($2, status),
       outcome = COALESCE($3, outcome),
       completed_at = CASE WHEN $2 IN ('done','published','skipped') THEN NOW() ELSE completed_at END,
       metadata = metadata || $4::jsonb,
       updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      jobId,
      input.status ?? null,
      input.outcome ?? null,
      JSON.stringify(input.notes ? { notes: input.notes } : {}),
    ]
  );
  return result.rows[0] ? mapJob(result.rows[0]) : null;
}

export async function publishOwnedJob(userId: string, jobId: string) {
  const row = await query<JobRow & { project_id: string | null }>(
    `SELECT j.*, c.project_id
     FROM network_campaign_jobs j
     JOIN network_campaigns c ON c.id = j.campaign_id
     WHERE j.id = $1 AND c.user_id = $2`,
    [jobId, userId]
  );
  const job = row.rows[0];
  if (!job) return null;
  if (job.channel_type !== "owned_social") {
    throw new Error("Only owned social jobs can be published from here");
  }

  const published = await createSocialPost(userId, {
    platform: job.platform,
    content: job.content,
    projectId: job.project_id ?? undefined,
    creativeId: job.creative_id ?? undefined,
    publishNow: true,
  });

  const status = published.post.status === "published" ? "published" : published.post.status === "failed" ? "failed" : "ready";
  const updated = await query<JobRow>(
    `UPDATE network_campaign_jobs SET
       status = $2,
       social_post_id = $3,
       external_ref = $4,
       error_detail = $5,
       published_at = CASE WHEN $2 = 'published' THEN NOW() ELSE published_at END,
       updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      jobId,
      status,
      published.post.id,
      published.post.externalPostId,
      published.post.errorDetail ?? (status === "failed" ? published.message : null),
    ]
  );
  return { job: mapJob(updated.rows[0]), message: published.message };
}

export async function upsertMembership(
  userId: string,
  communityId: string,
  input: { status: string; fitScore?: number; fitReason?: string }
) {
  const result = await query(
    `INSERT INTO network_memberships (user_id, community_id, status, fit_score, fit_reason)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (user_id, community_id) DO UPDATE SET
       status = EXCLUDED.status,
       fit_score = COALESCE(EXCLUDED.fit_score, network_memberships.fit_score),
       fit_reason = COALESCE(EXCLUDED.fit_reason, network_memberships.fit_reason),
       updated_at = NOW()
     RETURNING *`,
    [userId, communityId, input.status, input.fitScore ?? null, input.fitReason ?? null]
  );
  return result.rows[0];
}

export async function listMemberships(userId: string) {
  const result = await query<{
    id: string;
    community_id: string;
    status: string;
    fit_score: number | null;
    fit_reason: string | null;
    name: string;
    platform: string;
    url: string;
  }>(
    `SELECT m.id, m.community_id, m.status, m.fit_score, m.fit_reason,
            c.name, c.platform, c.url
     FROM network_memberships m
     JOIN network_communities c ON c.id = m.community_id
     WHERE m.user_id = $1
     ORDER BY m.updated_at DESC`,
    [userId]
  );
  return result.rows.map((r) => ({
    id: r.id,
    communityId: r.community_id,
    status: r.status,
    fitScore: r.fit_score,
    fitReason: r.fit_reason,
    name: r.name,
    platform: r.platform,
    url: r.url,
  }));
}
