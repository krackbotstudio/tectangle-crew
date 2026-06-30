import { query } from "../db.js";
import { publishToSocialPlatform, resolveSocialAccount } from "./socialPublisher.js";
import { getCreativeById } from "./creativePublish.js";

export interface SocialPostRow {
  id: string;
  user_id: string;
  project_id: string | null;
  agent_id: string | null;
  social_account_id: string | null;
  creative_id: string | null;
  platform: string;
  content: string;
  status: string;
  scheduled_at: string | null;
  published_at: string | null;
  external_post_id: string | null;
  error_detail: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  handle?: string;
}

export function mapSocialPost(row: SocialPostRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    agentId: row.agent_id,
    socialAccountId: row.social_account_id,
    creativeId: row.creative_id,
    platform: row.platform,
    content: row.content,
    status: row.status,
    scheduledAt: row.scheduled_at,
    publishedAt: row.published_at,
    externalPostId: row.external_post_id,
    errorDetail: row.error_detail,
    handle: row.handle ?? null,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listSocialPosts(userId: string, projectId?: string) {
  let sql = `
    SELECT sp.*, sa.handle
    FROM social_posts sp
    LEFT JOIN social_accounts sa ON sa.id = sp.social_account_id
    WHERE sp.user_id = $1`;
  const params: unknown[] = [userId];
  if (projectId) {
    params.push(projectId);
    sql += ` AND sp.project_id = $${params.length}`;
  }
  sql += ` ORDER BY COALESCE(sp.scheduled_at, sp.created_at) DESC LIMIT 100`;

  const result = await query<SocialPostRow>(sql, params);
  return result.rows.map(mapSocialPost);
}

export async function createSocialPost(
  userId: string,
  input: {
    platform: string;
    content: string;
    projectId?: string;
    agentId?: string;
    creativeId?: string;
    handle?: string;
    socialAccountId?: string;
    scheduledAt?: string;
    publishNow?: boolean;
  }
) {
  let accountId = input.socialAccountId ?? null;
  let handle = input.handle;

  if (!accountId) {
    const account = await resolveSocialAccount(userId, input.platform, input.handle);
    if (account) {
      accountId = account.id;
      handle = account.handle;
    }
  }

  const status = input.publishNow ? "publishing" : input.scheduledAt ? "scheduled" : "draft";

  const inserted = await query<SocialPostRow>(
    `INSERT INTO social_posts
       (user_id, project_id, agent_id, social_account_id, creative_id, platform, content, status, scheduled_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz)
     RETURNING *`,
    [
      userId,
      input.projectId ?? null,
      input.agentId ?? null,
      accountId,
      input.creativeId ?? null,
      input.platform,
      input.content,
      status,
      input.scheduledAt ?? null,
    ]
  );

  const post = inserted.rows[0];

  if (input.publishNow) {
    const published = await publishSocialPostById(userId, post.id);
    return (
      published ?? {
        post: mapSocialPost({ ...post, handle: handle ?? undefined }),
        message: "Post could not be published.",
      }
    );
  }

  return {
    post: mapSocialPost({ ...post, handle: handle ?? undefined }),
    message: input.scheduledAt
      ? `Post scheduled for ${input.platform} at ${new Date(input.scheduledAt).toLocaleString()}.`
      : `Draft saved for ${input.platform}.`,
  };
}

export async function publishSocialPostById(userId: string, postId: string) {
  const row = await query<SocialPostRow & { handle?: string }>(
    `SELECT sp.*, sa.handle FROM social_posts sp
     LEFT JOIN social_accounts sa ON sa.id = sp.social_account_id
     WHERE sp.id = $1 AND sp.user_id = $2`,
    [postId, userId]
  );
  const post = row.rows[0];
  if (!post) return null;

  let creativeFileName: string | undefined;
  if (post.creative_id) {
    const creative = await getCreativeById(post.creative_id);
    creativeFileName = creative?.fileName;
  }

  const result = await publishToSocialPlatform({
    userId,
    platform: post.platform,
    content: post.content,
    handle: post.handle ?? undefined,
    creativeId: post.creative_id ?? undefined,
    creativeFileName,
  });

  if (!result.success) {
    await query(
      `UPDATE social_posts SET status = 'failed', error_detail = $2, updated_at = NOW() WHERE id = $1`,
      [postId, result.message]
    );
    return { post: mapSocialPost({ ...post, status: "failed", error_detail: result.message }), message: result.message };
  }

  const updated = await query<SocialPostRow>(
    `UPDATE social_posts SET
       status = 'published',
       published_at = NOW(),
       external_post_id = $2,
       error_detail = NULL,
       metadata = metadata || $3::jsonb,
       updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [postId, result.externalPostId, JSON.stringify({ live: result.live })]
  );

  return {
    post: mapSocialPost({ ...updated.rows[0], handle: post.handle }),
    message: result.message,
  };
}

export async function scheduleSocialPostById(
  userId: string,
  postId: string,
  scheduledAt: string
) {
  const updated = await query<SocialPostRow>(
    `UPDATE social_posts SET status = 'scheduled', scheduled_at = $3::timestamptz, updated_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [postId, userId, scheduledAt]
  );
  if (!updated.rows[0]) return null;
  return {
    post: mapSocialPost(updated.rows[0]),
    message: `Post scheduled for ${new Date(scheduledAt).toLocaleString()}.`,
  };
}
