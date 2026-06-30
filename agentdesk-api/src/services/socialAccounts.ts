import { query } from "../db.js";

export interface SocialAccountRow {
  id: string;
  user_id: string;
  platform: string;
  handle: string;
  display_name: string | null;
  profile_url: string | null;
  integration_slug: string | null;
  config: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function mapSocialAccount(row: SocialAccountRow) {
  return {
    id: row.id,
    platform: row.platform,
    handle: row.handle,
    displayName: row.display_name,
    profileUrl: row.profile_url,
    integrationSlug: row.integration_slug,
    config: row.config ?? {},
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listSocialAccounts(userId: string) {
  const result = await query<SocialAccountRow>(
    `SELECT * FROM social_accounts WHERE user_id = $1 ORDER BY platform, handle`,
    [userId]
  );
  return result.rows.map(mapSocialAccount);
}

export async function createSocialAccount(
  userId: string,
  input: {
    platform: string;
    handle: string;
    displayName?: string;
    profileUrl?: string;
    integrationSlug?: string;
    config?: Record<string, unknown>;
  }
) {
  const handle = input.handle.replace(/^@/, "").trim();
  const result = await query<SocialAccountRow>(
    `INSERT INTO social_accounts (user_id, platform, handle, display_name, profile_url, integration_slug, config)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     RETURNING *`,
    [
      userId,
      input.platform,
      handle,
      input.displayName ?? null,
      input.profileUrl ?? null,
      input.integrationSlug ?? null,
      JSON.stringify(input.config ?? {}),
    ]
  );
  return mapSocialAccount(result.rows[0]);
}

export async function updateSocialAccount(
  userId: string,
  accountId: string,
  input: {
    handle?: string;
    displayName?: string;
    profileUrl?: string;
    integrationSlug?: string;
    config?: Record<string, unknown>;
    isActive?: boolean;
  }
) {
  const result = await query<SocialAccountRow>(
    `UPDATE social_accounts SET
      handle = COALESCE($3, handle),
      display_name = COALESCE($4, display_name),
      profile_url = COALESCE($5, profile_url),
      integration_slug = COALESCE($6, integration_slug),
      config = COALESCE($7::jsonb, config),
      is_active = COALESCE($8, is_active),
      updated_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [
      accountId,
      userId,
      input.handle?.replace(/^@/, "").trim() ?? null,
      input.displayName ?? null,
      input.profileUrl ?? null,
      input.integrationSlug ?? null,
      input.config ? JSON.stringify(input.config) : null,
      input.isActive ?? null,
    ]
  );
  return result.rows[0] ? mapSocialAccount(result.rows[0]) : null;
}

export async function deleteSocialAccount(userId: string, accountId: string) {
  await query(`DELETE FROM social_accounts WHERE id = $1 AND user_id = $2`, [accountId, userId]);
}
