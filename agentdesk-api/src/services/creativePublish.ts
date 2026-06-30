import { query } from "../db.js";
import { publishToSocialPlatform, resolveSocialAccount } from "./socialPublisher.js";
import { listEffectiveToolsForAgentOnProject } from "./projectTools.js";
import { SOCIAL_PLATFORMS } from "./imageGeneration.js";
import { listSocialAccounts } from "./socialAccounts.js";

export interface CreativeRow {
  id: string;
  project_id: string | null;
  agent_id: string;
  user_id: string | null;
  message_id: string | null;
  prompt: string;
  purpose: string | null;
  width: number | null;
  height: number | null;
  file_name: string;
  mime_type: string;
  provider: string | null;
  status: string;
  publish_platform: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  publish_notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export function mapCreative(row: CreativeRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    agentId: row.agent_id,
    messageId: row.message_id,
    prompt: row.prompt,
    purpose: row.purpose,
    width: row.width,
    height: row.height,
    fileName: row.file_name,
    mimeType: row.mime_type,
    provider: row.provider,
    status: row.status,
    publishPlatform: row.publish_platform,
    scheduledAt: row.scheduled_at,
    publishedAt: row.published_at,
    publishNotes: row.publish_notes,
    downloadUrl: `/creatives/files/${row.file_name}`,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getCreativeById(id: string) {
  const result = await query<CreativeRow>(`SELECT * FROM agent_creatives WHERE id = $1`, [id]);
  return result.rows[0] ? mapCreative(result.rows[0]) : null;
}

export async function listCreativesForMessage(messageId: string) {
  const result = await query<CreativeRow>(
    `SELECT * FROM agent_creatives WHERE message_id = $1 ORDER BY created_at ASC`,
    [messageId]
  );
  return result.rows.map(mapCreative);
}

export async function listAvailablePublishPlatforms(
  projectId: string | null,
  agentId: string,
  userId?: string
) {
  if (!projectId) return [];
  const tools = await listEffectiveToolsForAgentOnProject(agentId, projectId);
  const connectedSlugs = new Set(
    tools.filter((t) => t.status === "connected").map((t) => t.toolSlug)
  );

  const platforms = SOCIAL_PLATFORMS.filter((p) =>
    p.requiresTools.some((slug) => connectedSlugs.has(slug))
  ).map((p) => ({ id: p.id, label: p.label }));

  if (platforms.length === 0 && userId) {
    const accounts = await listSocialAccounts(userId);
    const fromAccounts = accounts
      .filter((a) => a.isActive)
      .map((a) => ({
        id: a.platform,
        label: SOCIAL_PLATFORMS.find((p) => p.id === a.platform)?.label ?? a.platform,
      }));
    const seen = new Set<string>();
    return [...platforms, ...fromAccounts].filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }

  return platforms;
}

export async function scheduleCreative(
  creativeId: string,
  platform: string,
  scheduledAt: string,
  notes?: string,
  userId?: string
) {
  const result = await query<CreativeRow>(
    `UPDATE agent_creatives SET
       status = 'scheduled',
       publish_platform = $2,
       scheduled_at = $3::timestamptz,
       publish_notes = COALESCE($4, publish_notes),
       updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [creativeId, platform, scheduledAt, notes ?? null]
  );
  const row = result.rows[0];
  if (!row) return null;

  return {
    creative: mapCreative(row),
    message: `Creative scheduled for ${platform} at ${new Date(scheduledAt).toLocaleString()}. It will publish automatically when due (connect the platform in App Store + add your handle in Social).`,
  };
}

export async function publishCreativeNow(
  creativeId: string,
  platform: string,
  notes?: string,
  userId?: string
) {
  const existing = await query<CreativeRow>(`SELECT * FROM agent_creatives WHERE id = $1`, [creativeId]);
  const row = existing.rows[0];
  if (!row) return null;

  const account = userId ? await resolveSocialAccount(userId, platform) : null;

  const publishResult = await publishToSocialPlatform({
    userId: userId ?? row.user_id ?? "",
    platform,
    content: row.prompt,
    handle: account?.handle,
    creativeId: row.id,
    creativeFileName: row.file_name,
  });

  if (!publishResult.success) {
    await query(
      `UPDATE agent_creatives SET status = 'failed', publish_notes = $2, updated_at = NOW() WHERE id = $1`,
      [creativeId, publishResult.message]
    );
    return { creative: mapCreative({ ...row, status: "failed", publish_notes: publishResult.message }), message: publishResult.message };
  }

  const updated = await query<CreativeRow>(
    `UPDATE agent_creatives SET
       status = 'published',
       publish_platform = $2,
       published_at = NOW(),
       publish_notes = COALESCE($3, publish_notes),
       metadata = metadata || $4::jsonb,
       updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      creativeId,
      platform,
      notes ?? null,
      JSON.stringify({ externalPostId: publishResult.externalPostId, live: publishResult.live }),
    ]
  );

  return {
    creative: mapCreative(updated.rows[0]),
    message: publishResult.message,
  };
}
